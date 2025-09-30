# Fix Organization Switching Error

## 🚨 Problem
The error `Could not find the function public.switch_organization` occurs because the database migration hasn't been applied yet.

## 🔧 Solution Options

### Option 1: Apply the Migration (Recommended)

#### Step 1: Apply the Migration
Run this SQL in your Supabase SQL editor:

```sql
-- Create the switch_organization function
CREATE OR REPLACE FUNCTION public.switch_organization(p_user_id uuid, p_org_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_membership_exists boolean;
begin
  -- Check if user is a member of the organization
  select exists(
    select 1 from public.organization_members 
    where user_id = p_user_id and organization_id = p_org_id
  ) into v_membership_exists;
  
  if not v_membership_exists then
    raise exception 'User is not a member of this organization';
  end if;
  
  -- Set all memberships to not selected
  update public.organization_members 
  set last_selected = false 
  where user_id = p_user_id;
  
  -- Set the specified organization as selected
  update public.organization_members 
  set last_selected = true 
  where user_id = p_user_id and organization_id = p_org_id;
end;
$function$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.switch_organization(uuid, uuid) TO authenticated;
```

#### Step 2: Ensure last_selected Column Exists
```sql
-- Add last_selected column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'organization_members' 
        AND column_name = 'last_selected'
    ) THEN
        ALTER TABLE organization_members ADD COLUMN last_selected boolean DEFAULT false;
    END IF;
END $$;
```

#### Step 3: Create Index for Performance
```sql
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id 
ON organization_members(user_id);

CREATE INDEX IF NOT EXISTS idx_organization_members_last_selected 
ON organization_members(user_id, last_selected) 
WHERE last_selected = true;
```

### Option 2: Use the Fallback Implementation (Already Applied)

The code has been updated to automatically fall back to manual database updates if the function doesn't exist. This means:

1. **First attempt**: Try to use the `switch_organization` function
2. **Fallback**: If function doesn't exist, use manual SQL updates
3. **No errors**: The organization switching will work regardless

## 🚀 How to Apply the Fix

### Method 1: Supabase Dashboard
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the SQL from Step 1 above
4. Click **Run** to execute the migration

### Method 2: Supabase CLI
```bash
# If you have Supabase CLI installed
supabase db reset
# or
supabase migration up
```

### Method 3: Manual Application
1. Open your Supabase project
2. Go to **Database** → **SQL Editor**
3. Run the SQL commands one by one
4. Verify the functions exist in **Database** → **Functions**

## ✅ Verification Steps

### 1. Check if Function Exists
Run this query in Supabase SQL editor:
```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name = 'switch_organization';
```

### 2. Test the Function
```sql
-- Test with a real user ID and organization ID
SELECT public.switch_organization('your-user-id', 'your-org-id');
```

### 3. Check Organization Members Table
```sql
-- Verify last_selected column exists
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'organization_members' 
AND column_name = 'last_selected';
```

## 🔍 Troubleshooting

### If Migration Fails
1. **Check permissions**: Ensure you have admin access to the database
2. **Check existing functions**: Remove any conflicting functions first
3. **Check table structure**: Ensure `organization_members` table exists

### If Function Still Not Found
1. **Refresh schema cache**: The function might exist but cache needs refresh
2. **Check function name**: Ensure exact spelling `switch_organization`
3. **Check parameters**: Function expects `(p_user_id uuid, p_org_id uuid)`

### If Fallback Method Works
The fallback method should work immediately without any database changes. You'll see this in the console:
```
switch_organization function not found, using fallback method
```

## 🎯 Expected Behavior After Fix

### With Migration Applied:
- **Fast switching**: Uses optimized database function
- **Better performance**: Single function call instead of multiple queries
- **Error handling**: Proper validation of organization membership
- **Consistency**: Ensures only one organization is selected at a time

### With Fallback Method:
- **Manual updates**: Uses direct SQL updates to organization_members table
- **Same functionality**: Organization switching works the same way
- **Slightly slower**: Multiple database calls instead of single function
- **Still secure**: Proper validation and error handling

## 📱 Testing the Fix

### 1. Test Organization Switching
1. Login with a user that has multiple organizations
2. Try switching between organizations
3. Verify the current organization updates correctly
4. Check that role-based permissions work

### 2. Test Error Handling
1. Try switching to an organization you're not a member of
2. Verify proper error messages are shown
3. Check that the current organization doesn't change

### 3. Test Performance
1. Switch organizations multiple times quickly
2. Verify no performance issues
3. Check browser console for any errors

## 🎉 Success Indicators

After applying the fix, you should see:
- ✅ **No more "function not found" errors**
- ✅ **Organization switching works smoothly**
- ✅ **Current organization updates correctly**
- ✅ **Role-based permissions work per organization**
- ✅ **No console errors during switching**

The multi-organization support will now work perfectly! 🚀
