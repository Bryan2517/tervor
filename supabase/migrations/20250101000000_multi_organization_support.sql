-- Migration: Multi-Organization Support
-- This migration ensures that users can be members of multiple organizations
-- and properly handles organization switching functionality

-- Step 1: Ensure organization_members table has proper constraints for multi-org support
-- The table should allow multiple memberships per user

-- Check if the unique constraint exists and drop it if it prevents multi-org
DO $$ 
BEGIN
    -- Drop any unique constraint on user_id that would prevent multiple org memberships
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'organization_members_user_id_key' 
        AND table_name = 'organization_members'
    ) THEN
        ALTER TABLE organization_members DROP CONSTRAINT organization_members_user_id_key;
    END IF;
END $$;

-- Step 2: Ensure the primary key is composite (organization_id, user_id)
-- This allows users to be members of multiple organizations
DO $$ 
BEGIN
    -- Check if primary key exists and is composite
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'organization_members_pkey' 
        AND table_name = 'organization_members'
    ) THEN
        ALTER TABLE organization_members ADD CONSTRAINT organization_members_pkey 
        PRIMARY KEY (organization_id, user_id);
    END IF;
END $$;

-- Step 3: Add index for efficient user organization lookups
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id 
ON organization_members(user_id);

-- Step 4: Add index for efficient organization member lookups
CREATE INDEX IF NOT EXISTS idx_organization_members_org_id 
ON organization_members(organization_id);

-- Step 5: Add index for last_selected queries
CREATE INDEX IF NOT EXISTS idx_organization_members_last_selected 
ON organization_members(user_id, last_selected) 
WHERE last_selected = true;

-- Step 6: Update the add_member_upsert function to handle multi-org properly
CREATE OR REPLACE FUNCTION public.add_member_upsert(p_org uuid, p_user uuid, p_role user_role)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  insert into public.organization_members (organization_id, user_id, role, last_selected)
  values (p_org, p_user, p_role, true)
  on conflict (organization_id, user_id)
    do update set 
      role = excluded.role, 
      last_selected = true,
      created_at = case when organization_members.created_at is null then now() else organization_members.created_at end;
$function$;

-- Step 7: Create function to get user's organizations with roles
CREATE OR REPLACE FUNCTION public.get_user_organizations(p_user_id uuid)
RETURNS TABLE(
  organization_id uuid,
  organization_name text,
  organization_description text,
  organization_logo_url text,
  role user_role,
  last_selected boolean,
  created_at timestamp with time zone
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select 
    o.id as organization_id,
    o.name as organization_name,
    o.description as organization_description,
    o.logo_url as organization_logo_url,
    om.role,
    om.last_selected,
    om.created_at
  from public.organization_members om
  join public.organizations o on o.id = om.organization_id
  where om.user_id = p_user_id
  order by om.last_selected desc, om.created_at desc;
$function$;

-- Step 8: Create function to switch user's active organization
CREATE OR REPLACE FUNCTION public.switch_organization(p_user_id uuid, p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_membership_exists boolean;
begin
  -- Check if user is a member of the organization
  select exists(
    select 1 from public.organization_members 
    where user_id = p_user_id and organization_id = p_org_id
  ) into v_membership_exists;
  
  if not v_membership_exists then
    raise exception 'User is not a member of this organization';
  end if;
  
  -- Set all memberships to not selected
  update public.organization_members 
  set last_selected = false 
  where user_id = p_user_id;
  
  -- Set the specified organization as selected
  update public.organization_members 
  set last_selected = true 
  where user_id = p_user_id and organization_id = p_org_id;
end;
$function$;

-- Step 9: Create function to get user's current active organization
CREATE OR REPLACE FUNCTION public.get_current_organization(p_user_id uuid)
RETURNS TABLE(
  organization_id uuid,
  organization_name text,
  organization_description text,
  organization_logo_url text,
  role user_role
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  select 
    o.id as organization_id,
    o.name as organization_name,
    o.description as organization_description,
    o.logo_url as organization_logo_url,
    om.role
  from public.organization_members om
  join public.organizations o on o.id = om.organization_id
  where om.user_id = p_user_id and om.last_selected = true
  limit 1;
$function$;

-- Step 10: Update RLS policies to support multi-organization access
-- Drop existing policies that might conflict
DROP POLICY IF EXISTS "organization_members: select own memberships" ON organization_members;
DROP POLICY IF EXISTS "organization_members: insert own memberships" ON organization_members;
DROP POLICY IF EXISTS "organization_members: update own memberships" ON organization_members;

-- Create new RLS policies for multi-organization support
CREATE POLICY "organization_members: select own memberships" ON organization_members
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "organization_members: insert own memberships" ON organization_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "organization_members: update own memberships" ON organization_members
  FOR UPDATE USING (auth.uid() = user_id);

-- Allow organization admins to manage memberships
CREATE POLICY "organization_members: admin manage memberships" ON organization_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = organization_members.organization_id
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );

-- Step 11: Add trigger to ensure only one organization is selected at a time
CREATE OR REPLACE FUNCTION public.ensure_single_selected_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  -- If setting last_selected to true, set all others to false
  if NEW.last_selected = true then
    update public.organization_members 
    set last_selected = false 
    where user_id = NEW.user_id 
    and organization_id != NEW.organization_id;
  end if;
  
  return NEW;
end;
$function$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_ensure_single_selected_organization ON organization_members;
CREATE TRIGGER trigger_ensure_single_selected_organization
  BEFORE UPDATE ON organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_selected_organization();

-- Step 12: Add helpful comments
COMMENT ON TABLE organization_members IS 'Tracks user memberships across multiple organizations. Users can be members of multiple organizations with different roles.';
COMMENT ON COLUMN organization_members.last_selected IS 'Indicates which organization the user is currently working with. Only one organization can be selected per user.';
COMMENT ON COLUMN organization_members.role IS 'User role within this specific organization. Can be different across organizations.';

-- Step 13: Create view for easy organization switching
CREATE OR REPLACE VIEW public.user_organizations AS
SELECT 
  om.user_id,
  om.organization_id,
  o.name as organization_name,
  o.description as organization_description,
  o.logo_url as organization_logo_url,
  om.role,
  om.last_selected,
  om.created_at as joined_at
FROM public.organization_members om
JOIN public.organizations o ON o.id = om.organization_id;

-- Grant access to the view
GRANT SELECT ON public.user_organizations TO authenticated;

-- Step 14: Add helpful indexes for performance
CREATE INDEX IF NOT EXISTS idx_organization_members_role ON organization_members(role);
CREATE INDEX IF NOT EXISTS idx_organization_members_created_at ON organization_members(created_at);

-- Step 15: Update the claim_org_invite function to handle existing memberships
CREATE OR REPLACE FUNCTION public.claim_org_invite(p_code uuid)
RETURNS TABLE(organization_id uuid, role user_role)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_inv public.org_invites%rowtype;
  v_uid uuid := auth.uid();
  v_email text := (select email from public.users where id = v_uid);
  v_existing_membership boolean;
begin
  if v_uid is null then
    raise exception 'Must be signed in';
  end if;

  select * into v_inv
  from public.org_invites
  where code = p_code;

  if not found then
    raise exception 'Invalid invite code';
  end if;

  if v_inv.used_at is not null then
    raise exception 'Invite already used';
  end if;

  if v_inv.expires_at < now() then
    raise exception 'Invite expired';
  end if;

  if v_inv.email is not null and v_inv.email <> v_email then
    raise exception 'Invite is restricted to a different email';
  end if;

  -- Check if user is already a member of this organization
  select exists(
    select 1 from public.organization_members 
    where user_id = v_uid and organization_id = v_inv.organization_id
  ) into v_existing_membership;
  
  if v_existing_membership then
    raise exception 'You are already a member of this organization';
  end if;

  -- Add membership (bypasses RLS via security definer)
  perform public.add_member_upsert(v_inv.organization_id, v_uid, v_inv.role);

  -- mark invite as used
  update public.org_invites
  set used_by = v_uid, used_at = now()
  where id = v_inv.id;

  return query
  select v_inv.organization_id, v_inv.role;
end;
$function$;
