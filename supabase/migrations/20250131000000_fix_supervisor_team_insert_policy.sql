-- Fix RLS policy for supervisors to insert teams
-- The issue was that teams.supervisor_id was being referenced inside the EXISTS subquery
-- which doesn't work correctly during INSERT operations
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

