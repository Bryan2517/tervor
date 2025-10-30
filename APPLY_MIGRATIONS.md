# Quick Guide: Applying Notification System Migrations

## Prerequisites

- Supabase project set up and running
- Database connection access
- Supabase CLI installed (optional but recommended)

## Method 1: Using Supabase CLI (Recommended)

### Step 1: Initialize Supabase (if not already done)
```bash
cd "C:\Users\bryan\Desktop\APU\WPH hackathon\tervor"
supabase init
```

### Step 2: Link to your project
```bash
supabase link --project-ref your-project-ref
```

### Step 3: Apply migrations
```bash
supabase db push
```

This will apply both migration files:
- `20250130000000_create_extension_notification_triggers.sql`
- `20250130000001_add_notifications_rls_policies.sql`

### Step 4: Verify migrations
```bash
supabase migration list
```

## Method 2: Using Supabase Dashboard

### Step 1: Access SQL Editor
1. Go to your Supabase project: https://app.supabase.com
2. Navigate to **SQL Editor** in the left sidebar

### Step 2: Run First Migration
1. Click **New Query**
2. Copy the entire contents of `supabase/migrations/20250130000000_create_extension_notification_triggers.sql`
3. Paste into the SQL editor
4. Click **Run** or press `Ctrl+Enter`
5. Verify no errors appear

### Step 3: Run Second Migration
1. Click **New Query**
2. Copy the entire contents of `supabase/migrations/20250130000001_add_notifications_rls_policies.sql`
3. Paste into the SQL editor
4. Click **Run** or press `Ctrl+Enter`
5. Verify no errors appear

## Method 3: Using Direct Database Connection

If you have direct access to your PostgreSQL database:

```bash
# Connect to your database
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"

# Run migrations
\i supabase/migrations/20250130000000_create_extension_notification_triggers.sql
\i supabase/migrations/20250130000001_add_notifications_rls_policies.sql
```

## Verification Steps

After applying migrations, verify the setup:

### 1. Check Triggers
```sql
SELECT 
    tgname as trigger_name,
    tgenabled as enabled,
    proname as function_name
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE tgname LIKE 'extension_request%';
```

Expected output:
```
trigger_name                        | enabled | function_name
------------------------------------+---------+----------------------------------
extension_request_created_trigger   | O       | notify_extension_request_created
extension_request_decided_trigger   | O       | notify_extension_request_decided
```

### 2. Check Notification Type Enum
```sql
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = 'notification_type'::regtype
ORDER BY enumsortorder;
```

Should include: `extension_requested`

### 3. Check RLS Policies
```sql
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd
FROM pg_policies 
WHERE tablename = 'notifications'
ORDER BY policyname;
```

Expected output: 4 policies
- Users can view their own notifications (SELECT)
- Users can update their own notifications (UPDATE)
- Users can delete their own notifications (DELETE)
- System can insert notifications for any user (INSERT)

### 4. Check Indexes
```sql
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'notifications';
```

Should show 3 new indexes:
- idx_notifications_user_id
- idx_notifications_user_id_read_at
- idx_notifications_created_at

### 5. Test Trigger Functions
```sql
-- Test getting organization admins
SELECT * FROM get_task_organization_admins('[any-task-id]'::uuid);
```

### 6. Enable Realtime (if not already enabled)

In Supabase Dashboard:
1. Go to **Database** → **Replication**
2. Find `notifications` table
3. Ensure the switch is **ON**

## Common Issues

### Issue 1: "relation already exists"
**Solution:** The migration has already been applied. Skip to verification steps.

### Issue 2: "function already exists"
**Solution:** Drop the existing functions first:
```sql
DROP FUNCTION IF EXISTS get_task_organization_admins(UUID);
DROP FUNCTION IF EXISTS notify_extension_request_created();
DROP FUNCTION IF EXISTS notify_extension_request_decided();
```
Then rerun the migration.

### Issue 3: "type already exists"
**Solution:** The `extension_requested` enum value already exists. This is fine, the migration handles this with a conditional check.

### Issue 4: "permission denied"
**Solution:** Ensure you're connected as a superuser or the postgres user. The triggers use `SECURITY DEFINER` which requires elevated permissions.

### Issue 5: Realtime not working
**Solution:** 
1. Go to Database → Replication in Supabase Dashboard
2. Enable realtime for the `notifications` table
3. Refresh your browser

## Testing the Migration

### Quick Test Script

Run this after applying migrations:

```sql
-- 1. Create a test user (or use existing user ID)
-- Replace [USER_ID] and [TASK_ID] with actual IDs from your database

-- 2. Create a test extension request
INSERT INTO extension_requests (
    task_id, 
    requester_id, 
    requested_due_at, 
    reason,
    status
)
VALUES (
    '[TASK_ID]'::uuid,
    '[USER_ID]'::uuid,
    NOW() + INTERVAL '7 days',
    'Test notification system',
    'pending'
)
RETURNING id;

-- 3. Check if notifications were created for admins/owners
SELECT 
    n.id,
    n.user_id,
    n.type,
    n.payload->>'message' as message,
    u.full_name,
    om.role
FROM notifications n
JOIN users u ON n.user_id = u.id
JOIN organization_members om ON u.id = om.user_id
WHERE n.type = 'extension_requested'
ORDER BY n.created_at DESC
LIMIT 5;

-- 4. Simulate approval
UPDATE extension_requests 
SET 
    status = 'approved',
    decided_by = '[ADMIN_USER_ID]'::uuid,
    decided_at = NOW(),
    decision_note = 'Approved for testing'
WHERE id = '[EXTENSION_REQUEST_ID]'::uuid;

-- 5. Check if approval notification was created for requester
SELECT 
    n.id,
    n.user_id,
    n.type,
    n.payload->>'message' as message,
    u.full_name
FROM notifications n
JOIN users u ON n.user_id = u.id
WHERE n.type = 'extension_approved'
ORDER BY n.created_at DESC
LIMIT 1;

-- 6. Clean up test data
DELETE FROM notifications WHERE payload->>'message' LIKE '%Test notification%';
DELETE FROM extension_requests WHERE reason = 'Test notification system';
```

## Post-Migration Steps

1. ✅ Verify all checks pass
2. ✅ Test trigger functions
3. ✅ Enable realtime on notifications table
4. ✅ Deploy frontend changes
5. ✅ Test end-to-end flow with real users

## Rollback (if needed)

If you need to rollback the migrations:

```sql
-- Drop triggers
DROP TRIGGER IF EXISTS extension_request_created_trigger ON extension_requests;
DROP TRIGGER IF EXISTS extension_request_decided_trigger ON extension_requests;

-- Drop functions
DROP FUNCTION IF EXISTS get_task_organization_admins(UUID);
DROP FUNCTION IF EXISTS notify_extension_request_created();
DROP FUNCTION IF EXISTS notify_extension_request_decided();

-- Drop RLS policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
DROP POLICY IF EXISTS "System can insert notifications for any user" ON notifications;

-- Drop indexes
DROP INDEX IF EXISTS idx_notifications_user_id;
DROP INDEX IF EXISTS idx_notifications_user_id_read_at;
DROP INDEX IF EXISTS idx_notifications_created_at;

-- Note: We don't remove the enum value as that can break existing data
-- If absolutely necessary:
-- ALTER TYPE notification_type DROP VALUE 'extension_requested';
```

## Success Criteria

✅ Both migrations applied without errors  
✅ Triggers exist and are enabled  
✅ RLS policies created  
✅ Indexes created  
✅ Enum updated with new notification type  
✅ Realtime enabled for notifications table  
✅ Test notifications created successfully  

## Next Steps

After successfully applying migrations:
1. Deploy frontend changes (`npm run build` or `npm run dev`)
2. Test notification system end-to-end
3. Monitor application logs for any errors
4. Review `NOTIFICATION_SYSTEM_GUIDE.md` for full documentation

## Support Resources

- **Supabase Docs:** https://supabase.com/docs
- **Supabase CLI:** https://supabase.com/docs/guides/cli
- **PostgreSQL Triggers:** https://www.postgresql.org/docs/current/sql-createtrigger.html
- **RLS Policies:** https://supabase.com/docs/guides/auth/row-level-security

---

**Last Updated:** January 30, 2025  
**Migration Version:** 20250130000000, 20250130000001

