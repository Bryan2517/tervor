# Check-in SQL Queries - Quick Reference

## 🚀 **Most Common Queries**

### **1. Check if User Has Checked In Today**
```sql
-- Simple check
SELECT COUNT(*) > 0 as has_checked_in
FROM attendance_checkins
WHERE org_id = 'your-org-id'
  AND user_id = 'your-user-id'
  AND local_date = CURRENT_DATE AT TIME ZONE 'Asia/Kuala_Lumpur';

-- Using the helper function
SELECT has_checked_in_today('your-org-id', 'your-user-id');
```

### **2. Create a Check-in**
```sql
-- Basic insert
INSERT INTO attendance_checkins (org_id, user_id, source)
VALUES ('your-org-id', 'your-user-id', 'web')
RETURNING *;

-- Using the safe function (handles duplicates)
SELECT * FROM create_daily_checkin('your-org-id', 'your-user-id', 'web');
```

### **3. Get Today's Check-ins**
```sql
-- Get all check-ins for today
SELECT * FROM get_checkins_for_date('your-org-id', CURRENT_DATE AT TIME ZONE 'Asia/Kuala_Lumpur');

-- Manual query
SELECT 
  ac.id,
  ac.clock_in_at,
  p.full_name,
  p.email
FROM attendance_checkins ac
JOIN profiles p ON p.id = ac.user_id
WHERE ac.org_id = 'your-org-id'
  AND ac.local_date = CURRENT_DATE AT TIME ZONE 'Asia/Kuala_Lumpur'
ORDER BY ac.clock_in_at ASC;
```

### **4. Get Check-ins for Specific Date**
```sql
-- Get check-ins for a specific date
SELECT * FROM get_checkins_for_date('your-org-id', '2024-01-15');

-- Manual query
SELECT 
  ac.id,
  ac.clock_in_at,
  p.full_name,
  p.email
FROM attendance_checkins ac
JOIN profiles p ON p.id = ac.user_id
WHERE ac.org_id = 'your-org-id'
  AND ac.local_date = '2024-01-15'
ORDER BY ac.clock_in_at ASC;
```

### **5. Search Check-ins by User**
```sql
-- Search by name or email
SELECT 
  ac.id,
  ac.clock_in_at,
  p.full_name,
  p.email
FROM attendance_checkins ac
JOIN profiles p ON p.id = ac.user_id
WHERE ac.org_id = 'your-org-id'
  AND ac.local_date = '2024-01-15'
  AND (LOWER(p.full_name) LIKE LOWER('%john%') OR LOWER(p.email) LIKE LOWER('%john%'))
ORDER BY ac.clock_in_at ASC;
```

### **6. Get Attendance Statistics**
```sql
-- Get daily stats
SELECT * FROM get_daily_attendance_stats('your-org-id', '2024-01-01', '2024-01-31');

-- Manual query for today's stats
SELECT 
  COUNT(*) as total_check_ins,
  COUNT(CASE WHEN clock_in_at::time <= '09:15:00' THEN 1 END) as on_time,
  COUNT(CASE WHEN clock_in_at::time > '09:15:00' THEN 1 END) as late
FROM attendance_checkins
WHERE org_id = 'your-org-id'
  AND local_date = CURRENT_DATE AT TIME ZONE 'Asia/Kuala_Lumpur';
```

### **7. Get Late Arrivals**
```sql
-- Get users who arrived late today
SELECT 
  p.full_name,
  p.email,
  ac.clock_in_at,
  TO_CHAR(ac.clock_in_at AT TIME ZONE 'Asia/Kuala_Lumpur', 'HH24:MI:SS') as check_in_time
FROM attendance_checkins ac
JOIN profiles p ON p.id = ac.user_id
WHERE ac.org_id = 'your-org-id'
  AND ac.local_date = CURRENT_DATE AT TIME ZONE 'Asia/Kuala_Lumpur'
  AND ac.clock_in_at::time > '09:15:00'
ORDER BY ac.clock_in_at ASC;
```

### **8. Export Data for CSV**
```sql
-- Query for CSV export
SELECT 
  p.full_name as "Name",
  p.email as "Email",
  TO_CHAR(ac.clock_in_at AT TIME ZONE 'Asia/Kuala_Lumpur', 'HH24:MI:SS') as "Clock-in Time",
  ac.local_date as "Date",
  ac.source as "Source"
FROM attendance_checkins ac
JOIN profiles p ON p.id = ac.user_id
WHERE ac.org_id = 'your-org-id'
  AND ac.local_date = '2024-01-15'
ORDER BY ac.clock_in_at ASC;
```

## 🔧 **Setup Queries**

### **Create Table (if not exists)**
```sql
-- Run this in Supabase SQL Editor
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

-- Create unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS uniq_daily_checkin 
ON attendance_checkins (org_id, user_id, local_date);
```

### **Enable RLS**
```sql
-- Enable Row Level Security
ALTER TABLE attendance_checkins ENABLE ROW LEVEL SECURITY;

-- Create policies (run these one by one)
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
```

## 🧪 **Testing Queries**

### **Insert Test Data**
```sql
-- Insert a test check-in (replace with your actual IDs)
INSERT INTO attendance_checkins (org_id, user_id, source)
VALUES ('your-org-id', 'your-user-id', 'web')
RETURNING *;
```

### **Verify Setup**
```sql
-- Check if table exists
SELECT table_name FROM information_schema.tables WHERE table_name = 'attendance_checkins';

-- Check if RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'attendance_checkins';

-- Check if policies exist
SELECT policyname FROM pg_policies WHERE tablename = 'attendance_checkins';
```

## 📊 **Analytics Queries**

### **Monthly Attendance Report**
```sql
-- Get monthly attendance summary
SELECT 
  local_date,
  COUNT(*) as total_check_ins,
  COUNT(CASE WHEN clock_in_at::time <= '09:15:00' THEN 1 END) as on_time,
  COUNT(CASE WHEN clock_in_at::time > '09:15:00' THEN 1 END) as late
FROM attendance_checkins
WHERE org_id = 'your-org-id'
  AND local_date BETWEEN '2024-01-01' AND '2024-01-31'
GROUP BY local_date
ORDER BY local_date DESC;
```

### **User Attendance Summary**
```sql
-- Get attendance summary for all users
SELECT 
  p.full_name,
  p.email,
  COUNT(*) as total_check_ins,
  COUNT(CASE WHEN ac.clock_in_at::time <= '09:15:00' THEN 1 END) as on_time_count,
  COUNT(CASE WHEN ac.clock_in_at::time > '09:15:00' THEN 1 END) as late_count
FROM attendance_checkins ac
JOIN profiles p ON p.id = ac.user_id
WHERE ac.org_id = 'your-org-id'
  AND ac.local_date BETWEEN '2024-01-01' AND '2024-01-31'
GROUP BY p.id, p.full_name, p.email
ORDER BY total_check_ins DESC;
```

## 🚀 **Ready to Use!**

These queries provide everything you need for the daily check-in system:

- ✅ **Setup queries** - Create table and enable RLS
- ✅ **Core operations** - Check-in and retrieve data
- ✅ **Search and filter** - Find specific check-ins
- ✅ **Analytics** - Generate reports and statistics
- ✅ **Export** - Prepare data for CSV export

**Copy and paste these queries into your Supabase SQL Editor to get started!** 🎉
