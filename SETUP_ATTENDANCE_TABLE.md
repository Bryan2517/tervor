# Fix: attendance_checkins Table Not Found

## 🚨 **Error Explanation**
The error `relation "attendance_checkins" does not exist` means the table hasn't been created yet. You need to run the migration first.

## 🔧 **Step-by-Step Fix**

### **Step 1: Run the Migration**
Go to your Supabase dashboard and run this SQL in the SQL Editor:

```sql
-- Create the attendance_checkins table
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
```

### **Step 2: Enable Row Level Security**
```sql
-- Enable RLS
ALTER TABLE attendance_checkins ENABLE ROW LEVEL SECURITY;
```

### **Step 3: Create RLS Policies**
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

### **Step 4: Create Helper Function**
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

### **Step 5: Verify Table Creation**
```sql
-- Check if table was created successfully
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'attendance_checkins'
ORDER BY ordinal_position;

-- Check if indexes were created
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'attendance_checkins';

-- Check if RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'attendance_checkins';
```

## 🧪 **Test the Setup**

### **Test 1: Insert a Check-in**
```sql
-- Replace with your actual organization and user IDs
INSERT INTO attendance_checkins (org_id, user_id, source)
VALUES ('your-org-id-here', 'your-user-id-here', 'web')
RETURNING *;
```

### **Test 2: Check if User Has Checked In Today**
```sql
-- Replace with your actual IDs
SELECT COUNT(*) > 0 as has_checked_in
FROM attendance_checkins
WHERE org_id = 'your-org-id-here'
  AND user_id = 'your-user-id-here'
  AND local_date = CURRENT_DATE AT TIME ZONE 'Asia/Kuala_Lumpur';
```

### **Test 3: Get Today's Check-ins**
```sql
-- Replace with your actual organization ID
SELECT 
  ac.id,
  ac.clock_in_at,
  ac.local_date,
  ac.source,
  p.full_name,
  p.email
FROM attendance_checkins ac
JOIN profiles p ON p.id = ac.user_id
WHERE ac.org_id = 'your-org-id-here'
  AND ac.local_date = CURRENT_DATE AT TIME ZONE 'Asia/Kuala_Lumpur'
ORDER BY ac.clock_in_at ASC;
```

## 🚀 **Quick Setup Script**

If you want to run everything at once, here's the complete setup script:

```sql
-- Complete setup script for attendance_checkins table
-- Run this in your Supabase SQL Editor

-- 1. Create table
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

-- 2. Create constraints and indexes
CREATE UNIQUE INDEX IF NOT EXISTS uniq_daily_checkin 
ON attendance_checkins (org_id, user_id, local_date);

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

-- 5. Create helper function
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

GRANT EXECUTE ON FUNCTION create_daily_checkin TO authenticated;

-- 6. Verify setup
SELECT 'Table created successfully!' as status;
```

## ✅ **After Running the Setup**

Once you've run the setup script:

1. **The table will be created** with all necessary constraints
2. **RLS will be enabled** for secure access
3. **Helper functions** will be available
4. **Your check-in system** will work properly

## 🎯 **Next Steps**

After the table is created:

1. **Test the check-in functionality** in your app
2. **Verify the modal appears** on first login
3. **Check the supervisor page** for real-time updates
4. **Test CSV export** functionality

**The attendance_checkins table will now exist and your check-in system will work!** 🚀
