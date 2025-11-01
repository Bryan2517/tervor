-- Allow supervisors to create teams where they are the supervisor
DROP POLICY IF EXISTS "Supervisors can insert their own teams" ON public.teams;
CREATE POLICY "Supervisors can insert their own teams"
  ON public.teams
  FOR INSERT
  WITH CHECK (
    supervisor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = teams.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role = 'supervisor'
    )
  );

-- Allow supervisors to update teams where they are the supervisor
DROP POLICY IF EXISTS "Supervisors can update their own teams" ON public.teams;
CREATE POLICY "Supervisors can update their own teams"
  ON public.teams
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = teams.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role = 'supervisor'
      AND teams.supervisor_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = teams.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role = 'supervisor'
      AND teams.supervisor_id = auth.uid()
    )
  );

-- Allow supervisors to delete teams where they are the supervisor
DROP POLICY IF EXISTS "Supervisors can delete their own teams" ON public.teams;
CREATE POLICY "Supervisors can delete their own teams"
  ON public.teams
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = teams.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role = 'supervisor'
      AND teams.supervisor_id = auth.uid()
    )
  );

-- Allow supervisors to manage team members for teams where they are the supervisor
DROP POLICY IF EXISTS "Supervisors can manage members of their teams" ON public.team_members;
CREATE POLICY "Supervisors can manage members of their teams"
  ON public.team_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.teams
      JOIN public.organization_members ON organization_members.organization_id = teams.organization_id
      WHERE teams.id = team_members.team_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role = 'supervisor'
      AND teams.supervisor_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teams
      JOIN public.organization_members ON organization_members.organization_id = teams.organization_id
      WHERE teams.id = team_members.team_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.role = 'supervisor'
      AND teams.supervisor_id = auth.uid()
    )
  );


