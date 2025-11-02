-- Add policy to allow supervisors to update teams they supervise
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

