-- Recreate all RLS policies with the new role hierarchy

-- Function to check role management permissions  
CREATE OR REPLACE FUNCTION public.can_manage_roles(p_org uuid, p_manager_role user_role, p_target_role user_role)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT 
    CASE 
      WHEN p_manager_role = 'owner' THEN true
      WHEN p_manager_role = 'admin' AND p_target_role IN ('supervisor', 'employee') THEN true
      WHEN p_manager_role = 'supervisor' AND p_target_role = 'employee' THEN true
      ELSE false
    END;
$function$;

-- Projects policies (Owner and Admin can manage projects)
CREATE POLICY "projects_insert_owner_admin" 
ON projects FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM organization_members m
    WHERE m.organization_id = projects.organization_id 
    AND m.user_id = auth.uid() 
    AND m.role IN ('owner', 'admin')
  )
);

CREATE POLICY "projects_update_owner_admin" 
ON projects FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM organization_members m
    WHERE m.organization_id = projects.organization_id 
    AND m.user_id = auth.uid() 
    AND m.role IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM organization_members m
    WHERE m.organization_id = projects.organization_id 
    AND m.user_id = auth.uid() 
    AND m.role IN ('owner', 'admin')
  )
);

-- Tasks policies (Admin and Supervisor can manage tasks)
CREATE POLICY "tasks_insert_admin_supervisor" 
ON tasks FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects p
    JOIN organization_members m ON m.organization_id = p.organization_id
    WHERE p.id = tasks.project_id 
    AND m.user_id = auth.uid() 
    AND m.role IN ('owner', 'admin', 'supervisor')
  )
);

CREATE POLICY "tasks_update_admin_supervisor" 
ON tasks FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM projects p
    JOIN organization_members m ON m.organization_id = p.organization_id
    WHERE p.id = tasks.project_id 
    AND m.user_id = auth.uid() 
    AND m.role IN ('owner', 'admin', 'supervisor')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects p
    JOIN organization_members m ON m.organization_id = p.organization_id
    WHERE p.id = tasks.project_id 
    AND m.user_id = auth.uid() 
    AND m.role IN ('owner', 'admin', 'supervisor')
  )
);

-- Phases policies (Only Owner can manage phases and project progression)
CREATE POLICY "phases_insert_owner_only" 
ON phases FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects p
    JOIN organization_members m ON m.organization_id = p.organization_id
    WHERE p.id = phases.project_id 
    AND m.user_id = auth.uid() 
    AND m.role = 'owner'
  )
);

CREATE POLICY "phases_update_owner_only" 
ON phases FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM projects p
    JOIN organization_members m ON m.organization_id = p.organization_id
    WHERE p.id = phases.project_id 
    AND m.user_id = auth.uid() 
    AND m.role = 'owner'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM projects p
    JOIN organization_members m ON m.organization_id = p.organization_id
    WHERE p.id = phases.project_id 
    AND m.user_id = auth.uid() 
    AND m.role = 'owner'
  )
);

-- Org invites policy (Owner, Admin, Supervisor can invite)
CREATE POLICY "org_invites_insert_hierarchy" 
ON org_invites FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM organization_members m
    WHERE m.organization_id = org_invites.organization_id 
    AND m.user_id = auth.uid() 
    AND m.role IN ('owner', 'admin', 'supervisor')
  )
);

-- Update remove_member function with new role hierarchy
CREATE OR REPLACE FUNCTION public.remove_member(p_org uuid, p_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_actor_role user_role;
  v_target_role user_role;
  v_owner_count int;
begin
  if v_actor is null then
    raise exception 'Not authenticated';
  end if;

  select role into v_actor_role
  from public.organization_members
  where organization_id = p_org and user_id = v_actor;

  if v_actor_role is null then
    raise exception 'Actor is not a member of this organization';
  end if;

  select role into v_target_role
  from public.organization_members
  where organization_id = p_org and user_id = p_user;

  if v_target_role is null then
    raise exception 'Target user is not a member of this organization';
  end if;

  -- Check if actor can manage the target role
  if not public.can_manage_roles(p_org, v_actor_role, v_target_role) then
    raise exception 'Insufficient permission to remove this member';
  end if;

  -- Prevent removing the last owner
  if v_target_role = 'owner' then
    select count(*) into v_owner_count
    from public.organization_members
    where organization_id = p_org and role = 'owner';
    if v_owner_count <= 1 then
      raise exception 'Cannot remove the last owner';
    end if;
  end if;

  delete from public.organization_members
  where organization_id = p_org and user_id = p_user;
end;
$function$;