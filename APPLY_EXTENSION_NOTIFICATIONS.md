# Apply Extension Request Notification Triggers

## Problem
Extension request notifications are not working because the database triggers haven't been applied yet.

## Solution
You need to apply the migration file to your Supabase database.

### Option 1: Using Supabase SQL Editor (Recommended)

1. **Go to your Supabase Dashboard**
   - Navigate to https://supabase.com/dashboard
   - Select your project

2. **Open the SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New query"

3. **Copy and paste the migration**
   - Open the file: `supabase/migrations/20250130000000_create_extension_notification_triggers.sql`
   - Copy all the contents
   - Paste into the SQL Editor

4. **Run the migration**
   - Click "Run" or press `Ctrl+Enter`
   - Wait for the success message

5. **Verify the triggers were created**
   - Run this query to check:
   ```sql
   SELECT trigger_name, event_object_table, action_statement
   FROM information_schema.triggers
   WHERE trigger_name LIKE 'extension_request%';
   ```
   - You should see two triggers:
     - `extension_request_created_trigger`
     - `extension_request_decided_trigger`

### Option 2: Using Supabase CLI (If you have it configured)

1. **Link your project** (if not already linked):
   ```bash
   npx supabase link --project-ref YOUR_PROJECT_REF
   ```

2. **Push the migration**:
   ```bash
   npx supabase db push
   ```

## Testing the Notifications

After applying the migration, test it:

1. **Test Extension Request Creation**:
   - Log in as an Employee or Supervisor
   - Go to a project and request an extension for a task
   - Check if Owner/Admin receives a notification

2. **Test Extension Decision**:
   - Log in as Owner or Admin
   - Approve or reject an extension request
   - Check if the requester receives a notification

## Troubleshooting

### No notifications appearing after applying migration?

1. **Check if the triggers exist**:
   ```sql
   SELECT trigger_name, event_object_table
   FROM information_schema.triggers
   WHERE event_object_table = 'extension_requests';
   ```

2. **Check if notifications table has data**:
   ```sql
   SELECT * FROM notifications 
   WHERE type IN ('extension_requested', 'extension_approved', 'extension_rejected')
   ORDER BY created_at DESC
   LIMIT 10;
   ```

3. **Check for errors in the function**:
   - Try creating an extension request manually
   - Check Supabase logs for any errors

4. **Verify RLS policies**:
   - Make sure the RLS policies allow users to read their own notifications
   ```sql
   SELECT * FROM notifications 
   WHERE user_id = auth.uid() 
   ORDER BY created_at DESC;
   ```

### Still not working?

1. **Clear browser cache** and refresh the page
2. **Check browser console** for any JavaScript errors
3. **Verify the NotificationBell component** is rendered on your dashboard
4. **Check that you're logged in** as the correct user type

## Additional Migrations Needed

If notifications still don't work, you may also need to apply these migrations:

1. **RLS Policies** (`20250130000001_add_notifications_rls_policies.sql`)
2. **Task Assignment Notifications** (`20250130000002_add_task_assignment_notifications.sql`)

Apply them in the same way using the SQL Editor.

## Expected Behavior

✅ **When an extension is requested:**
- All Owners and Admins of the organization receive a notification
- Notification type: `extension_requested`
- Shows: requester name, task title, requested due date, reason

✅ **When an extension is approved:**
- The requester receives a notification
- Notification type: `extension_approved`
- Shows: task title, decision note (if any)

✅ **When an extension is rejected:**
- The requester receives a notification  
- Notification type: `extension_rejected`
- Shows: task title, decision note (if any)

## Need Help?

If you're still experiencing issues after following these steps:
1. Check the Supabase logs in your dashboard
2. Verify your database connection
3. Make sure your project has the required tables: `notifications`, `extension_requests`, `tasks`, `projects`, `organization_members`, `users`

