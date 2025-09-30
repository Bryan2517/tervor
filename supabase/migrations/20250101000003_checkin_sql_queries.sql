-- Daily Check-in System - Complete SQL Implementation
-- This file contains all the SQL queries needed for the check-in system

-- ==============================================
-- 1. TABLE CREATION AND CONSTRAINTS
-- ==============================================

-- Create the main attendance check-ins table
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

-- ==============================================
-- 2. ROW LEVEL SECURITY (RLS)
-- ==============================================

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

-- Update: users can update their own check-ins
CREATE POLICY "Users can update their own check-ins" ON attendance_checkins
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Delete: users can delete their own check-ins
CREATE POLICY "Users can delete their own check-ins" ON attendance_checkins
  FOR DELETE
  USING (user_id = auth.uid());

-- ==============================================
-- 3. CORE FUNCTIONS
-- ==============================================

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

-- ==============================================
-- 4. UTILITY FUNCTIONS
-- ==============================================

-- Function to check if user has checked in today
CREATE OR REPLACE FUNCTION has_checked_in_today(
  p_org_id uuid,
  p_user_id uuid,
  p_date date DEFAULT CURRENT_DATE AT TIME ZONE 'Asia/Kuala_Lumpur'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM attendance_checkins
    WHERE org_id = p_org_id
      AND user_id = p_user_id
      AND local_date = p_date
  );
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION has_checked_in_today TO authenticated;

-- Function to get check-ins for a specific date
CREATE OR REPLACE FUNCTION get_checkins_for_date(
  p_org_id uuid,
  p_date date
)
RETURNS TABLE (
  id uuid,
  clock_in_at timestamptz,
  local_date date,
  source text,
  user_id uuid,
  full_name text,
  email text,
  avatar_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ac.id,
    ac.clock_in_at,
    ac.local_date,
    ac.source,
    ac.user_id,
    p.full_name,
    p.email,
    p.avatar_url
  FROM attendance_checkins ac
  JOIN profiles p ON p.id = ac.user_id
  WHERE ac.org_id = p_org_id
    AND ac.local_date = p_date
  ORDER BY ac.clock_in_at ASC;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_checkins_for_date TO authenticated;

-- ==============================================
-- 5. ANALYTICS FUNCTIONS
-- ==============================================

-- Function to get daily attendance statistics
CREATE OR REPLACE FUNCTION get_daily_attendance_stats(
  p_org_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE (
  local_date date,
  total_check_ins bigint,
  on_time_count bigint,
  late_count bigint,
  on_time_percentage numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ac.local_date,
    COUNT(*) as total_check_ins,
    COUNT(CASE WHEN ac.clock_in_at::time <= '09:15:00' THEN 1 END) as on_time_count,
    COUNT(CASE WHEN ac.clock_in_at::time > '09:15:00' THEN 1 END) as late_count,
    ROUND(
      COUNT(CASE WHEN ac.clock_in_at::time <= '09:15:00' THEN 1 END) * 100.0 / COUNT(*), 
      2
    ) as on_time_percentage
  FROM attendance_checkins ac
  WHERE ac.org_id = p_org_id
    AND ac.local_date BETWEEN p_start_date AND p_end_date
  GROUP BY ac.local_date
  ORDER BY ac.local_date DESC;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_daily_attendance_stats TO authenticated;

-- ==============================================
-- 6. SAMPLE DATA (OPTIONAL - FOR TESTING)
-- ==============================================

-- Uncomment the following lines to insert sample data for testing
-- Note: Replace with actual organization and user IDs from your system

/*
-- Insert sample check-ins for testing
INSERT INTO attendance_checkins (org_id, user_id, source, clock_in_at)
VALUES 
  ('your-org-id-here', 'your-user-id-here', 'web', NOW() - INTERVAL '2 hours'),
  ('your-org-id-here', 'your-user-id-here', 'web', NOW() - INTERVAL '1 day'),
  ('your-org-id-here', 'your-user-id-here', 'web', NOW() - INTERVAL '2 days');
*/

-- ==============================================
-- 7. USEFUL QUERIES FOR TESTING
-- ==============================================

-- Check if the table was created successfully
SELECT 
  table_name, 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'attendance_checkins'
ORDER BY ordinal_position;

-- Check if indexes were created
SELECT 
  indexname, 
  indexdef
FROM pg_indexes 
WHERE tablename = 'attendance_checkins';

-- Check if RLS policies were created
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual
FROM pg_policies 
WHERE tablename = 'attendance_checkins';

-- Check if functions were created
SELECT 
  routine_name, 
  routine_type, 
  data_type
FROM information_schema.routines 
WHERE routine_name LIKE '%checkin%' 
  OR routine_name LIKE '%attendance%';

-- ==============================================
-- 8. CLEANUP QUERIES (USE WITH CAUTION)
-- ==============================================

-- Uncomment these lines if you need to clean up the check-in system
-- WARNING: These will delete all data!

/*
-- Drop the table (WARNING: This will delete all data!)
DROP TABLE IF EXISTS attendance_checkins CASCADE;

-- Drop the functions
DROP FUNCTION IF EXISTS create_daily_checkin(uuid, uuid, text);
DROP FUNCTION IF EXISTS has_checked_in_today(uuid, uuid, date);
DROP FUNCTION IF EXISTS get_checkins_for_date(uuid, date);
DROP FUNCTION IF EXISTS get_daily_attendance_stats(uuid, date, date);
*/
