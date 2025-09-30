# Fix: SQL Syntax Error in attendance_checkins Table

## 🚨 **Error Explanation**
The error `syntax error at or near "::"` occurs because the generated column syntax needs to be adjusted for PostgreSQL/Supabase compatibility.

## 🔧 **Fixed SQL Script**

Here's the corrected version that will work in Supabase:

```sql
-- Create the attendance_checkins table (FIXED VERSION)
CREATE TABLE IF NOT EXISTS attendance_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clock_in_at timestamptz NOT NULL DEFAULT now(),
  local_date date GENERATED ALWAYS AS (timezone('Asia/Kuala_Lumpur', clock_in_at)::date) STORED,
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

-- Create RLS policies
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

-- Create helper function
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
```

## 🔄 **Alternative Approach (If Generated Column Still Fails)**

If the generated column still causes issues, here's an alternative approach using a trigger:

```sql
-- Create table without generated column
CREATE TABLE IF NOT EXISTS attendance_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clock_in_at timestamptz NOT NULL DEFAULT now(),
  local_date date, -- Regular column instead of generated
  source text DEFAULT 'web',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create function to calculate local date
CREATE OR REPLACE FUNCTION calculate_local_date(clock_in_time timestamptz)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN (clock_in_time AT TIME ZONE 'Asia/Kuala_Lumpur')::date;
END;
$$;

-- Create trigger to automatically set local_date
CREATE OR REPLACE FUNCTION set_local_date()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.local_date = calculate_local_date(NEW.clock_in_at);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_local_date
  BEFORE INSERT OR UPDATE ON attendance_checkins
  FOR EACH ROW
  EXECUTE FUNCTION set_local_date();

-- Create unique constraint
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

-- Create RLS policies (same as above)
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

-- Create helper function
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
      AND local_date = calculate_local_date(now());
    
    RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION create_daily_checkin TO authenticated;
```

## 🧪 **Test the Fixed Table**

After running either version, test with:

```sql
-- Test insert
INSERT INTO attendance_checkins (org_id, user_id, source)
VALUES ('your-org-id-here', 'your-user-id-here', 'web')
RETURNING *;

-- Check if local_date was set correctly
SELECT 
  id,
  clock_in_at,
  local_date,
  source
FROM attendance_checkins
WHERE org_id = 'your-org-id-here'
ORDER BY created_at DESC
LIMIT 5;
```

## ✅ **Key Changes Made**

1. **Fixed generated column syntax**: Added parentheses around the timezone conversion
2. **Alternative trigger approach**: If generated columns don't work, use a trigger instead
3. **Proper function syntax**: Updated the helper function to work with the new structure

## 🚀 **Choose Your Approach**

- **Option 1**: Try the fixed generated column version first
- **Option 2**: If that fails, use the trigger-based approach

Both approaches will give you the same functionality - automatic calculation of the local date in Malaysia timezone.

**Run the fixed SQL script and your attendance table will be created successfully!** 🎉
