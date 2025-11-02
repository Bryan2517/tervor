# Apply Current Phase Migration

## Problem
When trying to select a phase in the Project Detail page, you get an error "failed to update phase" because the `current_phase` column doesn't exist in the `projects` table yet.

## Solution
Apply the migration using one of the methods below.

## Method 1: Using Supabase Dashboard (Recommended)

1. **Go to your Supabase Dashboard**
   - Navigate to https://app.supabase.com
   - Select your project

2. **Open the SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New query"

3. **Copy and paste the migration**
   - Open the file: `supabase/migrations/20250201000000_add_project_current_phase.sql`
   - Copy all the contents
   - Paste into the SQL Editor

4. **Run the migration**
   - Click "Run" or press `Ctrl+Enter`
   - Wait for the success message

5. **Verify the column was added**
   - Run this query to check:
   ```sql
   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_name = 'projects' 
   AND column_name = 'current_phase';
   ```
   - You should see the column with `text` data type and `nullable`

## Method 2: Using Supabase CLI (If you have it linked)

1. **Link your project** (if not already linked):
   ```bash
   npx supabase link --project-ref YOUR_PROJECT_REF
   ```

2. **Push the migration**:
   ```bash
   npx supabase db push
   ```

## Testing

After applying the migration:

1. Refresh your application
2. Go to a Project Detail page
3. Try selecting a phase from the dropdown
4. You should see "Project phase updated successfully" message

## Migration SQL

If you prefer to copy the SQL directly:

```sql
-- Add current_phase column to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS current_phase text;

-- Add comment for documentation
COMMENT ON COLUMN projects.current_phase IS 'Current phase of the project (e.g., Planning Phase, Development Phase, Deployment Phase, or custom phase)';
```

## Troubleshooting

### Still getting "failed to update phase" error?

1. **Check if the column exists**:
   ```sql
   SELECT column_name 
   FROM information_schema.columns
   WHERE table_name = 'projects' 
   AND column_name = 'current_phase';
   ```

2. **Check RLS policies**:
   ```sql
   SELECT policyname, cmd 
   FROM pg_policies 
   WHERE tablename = 'projects'
   AND cmd = 'UPDATE';
   ```
   - You should see a policy allowing owners and admins to update

3. **Verify you have the right permissions**:
   - Make sure you're logged in as an owner or admin
   - Check that you're part of the organization

### Need help?

- Check Supabase logs in the dashboard for detailed error messages
- Verify your authentication token is valid
- Make sure you're part of the organization with owner/admin role

