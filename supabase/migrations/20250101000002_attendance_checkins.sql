-- Create attendance_checkins table
CREATE TABLE IF NOT EXISTS attendance_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clock_in_at timestamptz NOT NULL DEFAULT now(),
  local_date date GENERATED ALWAYS AS (timezone('Asia/Kuala_Lumpur', clock_in_at))::date STORED,
  source text DEFAULT 'web',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create unique constraint to prevent duplicate check-ins per day
CREATE UNIQUE INDEX IF NOT EXISTS uniq_daily_checkin 
ON attendance_checkins (org_id, user_id, local_date);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_attendance_checkins_org_date 
ON attendance_checkins (org_id, local_date);

CREATE INDEX IF NOT EXISTS idx_attendance_checkins_user 
ON attendance_checkins (user_id);

CREATE INDEX IF NOT EXISTS idx_attendance_checkins_clock_in 
ON attendance_checkins (clock_in_at);

-- Enable RLS
ALTER TABLE attendance_checkins ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Select: org members can view check-ins for their organization
CREATE POLICY "Org members can view check-ins" ON attendance_checkins
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = org_id
      AND om.user_id = auth.uid()
    )
  );

-- Insert: users can insert their own check-ins for organizations they belong to
CREATE POLICY "Users can insert their own check-ins" ON attendance_checkins
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = org_id
      AND om.user_id = auth.uid()
    )
  );

-- Update: users can update their own check-ins (for future features)
CREATE POLICY "Users can update their own check-ins" ON attendance_checkins
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Delete: users can delete their own check-ins (for future features)
CREATE POLICY "Users can delete their own check-ins" ON attendance_checkins
  FOR DELETE
  USING (user_id = auth.uid());

-- Function to handle check-in with duplicate prevention
CREATE OR REPLACE FUNCTION create_daily_checkin(
  p_org_id uuid,
  p_user_id uuid,
  p_source text DEFAULT 'web'
)
RETURNS attendance_checkins
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result attendance_checkins;
BEGIN
  -- Try to insert the check-in
  INSERT INTO attendance_checkins (org_id, user_id, source)
  VALUES (p_org_id, p_user_id, p_source)
  RETURNING * INTO result;
  
  RETURN result;
EXCEPTION
  WHEN unique_violation THEN
    -- If duplicate, return the existing record
    SELECT * INTO result
    FROM attendance_checkins
    WHERE org_id = p_org_id
      AND user_id = p_user_id
      AND local_date = timezone('Asia/Kuala_Lumpur', now())::date;
    
    RETURN result;
END;
$$;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION create_daily_checkin TO authenticated;
