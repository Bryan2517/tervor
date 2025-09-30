-- Step 1: Drop all functions that depend on user_role enum
DROP FUNCTION IF EXISTS get_leaderboard(uuid, timestamp with time zone);
DROP FUNCTION IF EXISTS add_member_upsert(uuid, uuid, user_role);
DROP FUNCTION IF EXISTS claim_org_invite(uuid);

-- Step 2: Drop all policies that reference the user_role enum
DROP POLICY IF EXISTS "projects_insert_manager_plus" ON projects;
DROP POLICY IF EXISTS "projects_update_owner_admin" ON projects;
DROP POLICY IF EXISTS "tasks_insert_manager_plus" ON tasks;
DROP POLICY IF EXISTS "tasks_update_manager_plus" ON tasks;
DROP POLICY IF EXISTS "phases_insert_manager_plus" ON phases;
DROP POLICY IF EXISTS "phases_update_manager_plus" ON phases;
DROP POLICY IF EXISTS "org_invites: insert by org admin" ON org_invites;

-- Step 3: Now safely update the enum
ALTER TYPE user_role RENAME TO user_role_old;
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'supervisor', 'employee');

-- Step 4: Update table columns
ALTER TABLE organization_members 
  ALTER COLUMN role DROP DEFAULT,
  ALTER COLUMN role TYPE user_role USING 
    CASE 
      WHEN role::text = 'manager' THEN 'supervisor'::user_role
      ELSE role::text::user_role 
    END,
  ALTER COLUMN role SET DEFAULT 'employee'::user_role;

ALTER TABLE users 
  ALTER COLUMN role DROP DEFAULT,
  ALTER COLUMN role TYPE user_role USING 
    CASE 
      WHEN role::text = 'manager' THEN 'supervisor'::user_role
      ELSE role::text::user_role 
    END,
  ALTER COLUMN role SET DEFAULT 'employee'::user_role;

ALTER TABLE org_invites
  ALTER COLUMN role DROP DEFAULT,
  ALTER COLUMN role TYPE user_role USING 
    CASE 
      WHEN role::text = 'manager' THEN 'supervisor'::user_role
      ELSE role::text::user_role 
    END,
  ALTER COLUMN role SET DEFAULT 'employee'::user_role;

ALTER TABLE project_members
  ALTER COLUMN role DROP DEFAULT,
  ALTER COLUMN role TYPE user_role USING 
    CASE 
      WHEN role::text = 'manager' THEN 'supervisor'::user_role
      ELSE role::text::user_role 
    END,
  ALTER COLUMN role SET DEFAULT 'employee'::user_role;

-- Step 5: Drop old enum
DROP TYPE user_role_old;

-- Step 6: Recreate functions with new enum
CREATE OR REPLACE FUNCTION public.get_leaderboard(p_org uuid, p_since timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(user_id uuid, full_name text, email text, role user_role, avatar_url text, total_points integer, completed_tasks integer, rank integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
with members as (
  select u.id, u.full_name, u.email, u.role, u.avatar_url
  from organization_members om
  join users u on u.id = om.user_id
  where om.organization_id = p_org
),
completed as (
  select
    t.assignee_id as user_id,
    count(*)::int as completed_tasks,
    sum(
      case t.priority
        when 'high' then 3
        when 'medium' then 2
        when 'low' then 1
        else 1
      end
    )::int as total_points
  from tasks t
  join projects p on p.id = t.project_id
  where p.organization_id = p_org
    and t.status = 'done'
    and (p_since is null or t.updated_at >= p_since)
  group by t.assignee_id
)
select
  m.id as user_id,
  m.full_name,
  m.email,
  m.role,
  m.avatar_url,
  coalesce(c.total_points, 0) as total_points,
  coalesce(c.completed_tasks, 0) as completed_tasks,
  rank() over (order by coalesce(c.total_points,0) desc, m.full_name asc) as rank
from members m
left join completed c on c.user_id = m.id
order by rank;
$function$;

CREATE OR REPLACE FUNCTION public.add_member_upsert(p_org uuid, p_user uuid, p_role user_role)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  insert into public.organization_members (organization_id, user_id, role, last_selected)
  values (p_org, p_user, p_role, true)
  on conflict (organization_id, user_id)
    do update set role = excluded.role, last_selected = true;
$function$;

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

  -- upsert membership (bypasses RLS via security definer)
  perform public.add_member_upsert(v_inv.organization_id, v_uid, v_inv.role);

  -- mark invite as used
  update public.org_invites
  set used_by = v_uid, used_at = now()
  where id = v_inv.id;

  return query
  select v_inv.organization_id, v_inv.role;
end;
$function$;