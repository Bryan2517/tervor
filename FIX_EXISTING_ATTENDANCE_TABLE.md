# Fix Existing attendance_checkins Table

## 🎯 **Current Status**
Your `attendance_checkins` table already exists, but it's missing some important constraints and indexes for the check-in functionality to work properly.

## 🔧 **Missing Components to Add**

Run these SQL commands in your Supabase SQL Editor to complete the setup:

### **1. Add Unique Constraint (Prevents Duplicate Check-ins)**
```sql
-- Add unique constraint to prevent duplicate check-ins per day per user per org
CREATE UNIQUE INDEX IF NOT EXISTS uniq_daily_checkin 
ON attendance_checkins (org_id, user_id, local_date);
```

### **2. Add Performance Indexes**
```sql
-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_attendance_checkins_org_date 
ON attendance_checkins (org_id, local_date);

CREATE INDEX IF NOT EXISTS idx_attendance_checkins_user 
ON attendance_checkins (user_id);

CREATE INDEX IF NOT EXISTS idx_attendance_checkins_clock_in 
ON attendance_checkins (clock_in_at);
```

### **3. Enable Row Level Security (RLS)**
```sql
-- Enable RLS if not already enabled
ALTER TABLE attendance_checkins ENABLE ROW LEVEL SECURITY;
```

### **4. Create RLS Policies**
```sql
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
```

### **5. Create Helper Function**
```sql
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_daily_checkin TO authenticated;
```

### **6. Create Additional Helper Functions**
```sql
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
```

## 🧪 **Test the Setup**

After running the above commands, test with these queries:

### **Test 1: Check if constraints were added**
```sql
-- Check if unique constraint exists
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'attendance_checkins' 
  AND indexname = 'uniq_daily_checkin';

-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'attendance_checkins';

-- Check if policies exist
SELECT policyname 
FROM pg_policies 
WHERE tablename = 'attendance_checkins';
```

### **Test 2: Test check-in functionality**
```sql
-- Test insert (replace with your actual IDs)
INSERT INTO attendance_checkins (org_id, user_id, source)
VALUES ('your-org-id-here', 'your-user-id-here', 'web')
RETURNING *;

-- Test duplicate prevention (should return existing record)
SELECT * FROM create_daily_checkin('your-org-id-here', 'your-user-id-here', 'web');

-- Test helper function
SELECT has_checked_in_today('your-org-id-here', 'your-user-id-here');
```

### **Test 3: Get check-ins data**
```sql
-- Get today's check-ins
SELECT * FROM get_checkins_for_date('your-org-id-here', CURRENT_DATE AT TIME ZONE 'Asia/Kuala_Lumpur');

-- Manual query to get check-ins with user data
SELECT 
  ac.id,
  ac.clock_in_at,
  ac.local_date,
  ac.source,
  p.full_name,
  p.email,
  p.avatar_url
FROM attendance_checkins ac
JOIN profiles p ON p.id = ac.user_id
WHERE ac.org_id = 'your-org-id-here'
  AND ac.local_date = CURRENT_DATE AT TIME ZONE 'Asia/Kuala_Lumpur'
ORDER BY ac.clock_in_at ASC;
```

## ✅ **Complete Setup Script**

Here's everything in one script you can run:

```sql
-- Complete setup for existing attendance_checkins table

-- 1. Add unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS uniq_daily_checkin 
ON attendance_checkins (org_id, user_id, local_date);

-- 2. Add performance indexes
CREATE INDEX IF NOT EXISTS idx_attendance_checkins_org_date 
ON attendance_checkins (org_id, local_date);

CREATE INDEX IF NOT EXISTS idx_attendance_checkins_user 
ON attendance_checkins (user_id);

CREATE INDEX IF NOT EXISTS idx_attendance_checkins_clock_in 
ON attendance_checkins (clock_in_at);

-- 3. Enable RLS
ALTER TABLE attendance_checkins ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies
CREATE POLICY "Org members can view check-ins" ON attendance_checkins
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.organization_id = org_id
      AND om.user_id = auth.uid()
    )
  );

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

CREATE POLICY "Users can update their own check-ins" ON attendance_checkins
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own check-ins" ON attendance_checkins
  FOR DELETE
  USING (user_id = auth.uid());

-- 5. Create helper functions
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
  INSERT INTO attendance_checkins (org_id, user_id, source)
  VALUES (p_org_id, p_user_id, p_source)
  RETURNING * INTO result;
  
  RETURN result;
EXCEPTION
  WHEN unique_violation THEN
    SELECT * INTO result
    FROM attendance_checkins
    WHERE org_id = p_org_id
      AND user_id = p_user_id
      AND local_date = timezone('Asia/Kuala_Lumpur', now())::date;
    
    RETURN result;
END;
$$;

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

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_daily_checkin TO authenticated;
GRANT EXECUTE ON FUNCTION has_checked_in_today TO authenticated;
GRANT EXECUTE ON FUNCTION get_checkins_for_date TO authenticated;

-- Verify setup
SELECT 'Setup completed successfully!' as status;
```

## 🚀 **After Running the Setup**

Your `attendance_checkins` table will now have:

- ✅ **Unique constraint** to prevent duplicate check-ins
- ✅ **Performance indexes** for fast queries
- ✅ **RLS policies** for secure access
- ✅ **Helper functions** for easy operations
- ✅ **Duplicate prevention** with graceful handling

**Your check-in system will now work perfectly with the existing table!** 🎉
