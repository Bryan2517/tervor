-- Fix RLS policy for supervisors to insert team members
-- The issue is that during INSERT, team_members.team_id in subqueries needs proper scoping
-- Solution: Restructure to check team first, then verify supervisor relationship
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
    -- Check that the team exists and the current user is its supervisor
    EXISTS (
      SELECT 1 
      FROM public.teams t
      WHERE t.id = team_members.team_id
        AND t.supervisor_id = auth.uid()
        AND EXISTS (
          SELECT 1 
          FROM public.organization_members om
          WHERE om.organization_id = t.organization_id
            AND om.user_id = auth.uid()
            AND om.role = 'supervisor'
        )
    )
  );

