-- Simplified migration to fix organization switching
-- This creates the essential functions without complex constraints

-- Step 1: Create the switch_organization function
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

-- Step 2: Create function to get user's organizations
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

-- Step 3: Create function to get current organization
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

-- Step 4: Ensure last_selected column exists and has default value
DO $$ 
BEGIN
    -- Add last_selected column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organization_members' 
        AND column_name = 'last_selected'
    ) THEN
        ALTER TABLE organization_members ADD COLUMN last_selected boolean DEFAULT false;
    END IF;
END $$;

-- Step 5: Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id 
ON organization_members(user_id);

CREATE INDEX IF NOT EXISTS idx_organization_members_last_selected 
ON organization_members(user_id, last_selected) 
WHERE last_selected = true;

-- Step 6: Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.switch_organization(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_organizations(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_organization(uuid) TO authenticated;
