# Task Assignment & Due Date Reminder Notifications

## Overview

This guide covers the new notification features:
1. **Task Assignment Notifications** - Automatic notifications when users are assigned to tasks or assignments
2. **Due Date Reminder Notifications** - Scheduled reminders for tasks approaching their due date

## Features

### 1. Task Assignment Notifications

**When triggered:**
- A new task/assignment is created with an assignee
- An existing task/assignment is reassigned to a different user

**What the assignee receives:**
- ✅ Instant notification showing task title
- ✅ Task type (Task or Assignment)
- ✅ Priority level
- ✅ Due date (if set)
- ✅ Who assigned them

**Visual appearance:**
- 🔵 Blue background with user plus icon
- Shows "You have been assigned to [task name]"
- Includes task details in the notification

### 2. Due Date Reminder Notifications

**When triggered:**
- Task is due within 24 hours
- Task is not completed (status ≠ done or submitted)
- No reminder sent in the last 12 hours (prevents spam)

**Reminder levels:**
- ⚠️ **Urgent** (< 6 hours): "⚠️ Urgent: [task] is due in less than 6 hours!"
- 🔔 **Warning** (< 12 hours): "Reminder: [task] is due in less than 12 hours"
- 📅 **Notice** (< 24 hours): "Reminder: [task] is due within 24 hours"

**Visual appearance:**
- 🟠 Orange background with alert triangle icon
- Shows urgency level and time remaining
- Includes task details

## Database Setup

### Migration File

**Location:** `supabase/migrations/20250130000002_add_task_assignment_notifications.sql`

**What it creates:**
1. `notify_task_assigned()` - Trigger function for task assignments
2. `send_due_date_reminders()` - Function to check and send due date reminders
3. `task_assigned_trigger` - Trigger on tasks table
4. Performance index on `tasks(due_date, assignee_id)`

### Apply Migration

**Using Supabase CLI:**
```bash
supabase db push
```

**Using Supabase Dashboard:**
1. Go to SQL Editor
2. Copy contents of `20250130000002_add_task_assignment_notifications.sql`
3. Run the query

## Setting Up Due Date Reminders

Due date reminders require periodic execution of the `send_due_date_reminders()` function. Here are several options:

### Option 1: Using Supabase Edge Functions (Recommended)

Create a scheduled Edge Function that runs every hour:

**1. Create Edge Function:**
```typescript
// supabase/functions/send-reminders/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Call the database function
    const { error } = await supabaseClient.rpc('send_due_date_reminders')

    if (error) throw error

    return new Response(
      JSON.stringify({ success: true, message: 'Reminders sent' }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
```

**2. Deploy Edge Function:**
```bash
supabase functions deploy send-reminders
```

**3. Set up Cron Job (using external service):**

Use services like:
- **GitHub Actions** (free, runs hourly)
- **Cron-job.org** (free, flexible scheduling)
- **UptimeRobot** (free, checks every 5 minutes)

Example GitHub Actions workflow:
```yaml
# .github/workflows/send-reminders.yml
name: Send Due Date Reminders

on:
  schedule:
    # Run every hour at :00
    - cron: '0 * * * *'
  workflow_dispatch: # Manual trigger

jobs:
  send-reminders:
    runs-on: ubuntu-latest
    steps:
      - name: Call Edge Function
        run: |
          curl -X POST \
            "${{ secrets.SUPABASE_URL }}/functions/v1/send-reminders" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}"
```

### Option 2: Using pg_cron (If Available)

If your Supabase project has pg_cron enabled:

```sql
-- Schedule to run every hour
SELECT cron.schedule(
  'send-due-date-reminders',
  '0 * * * *',
  'SELECT send_due_date_reminders();'
);

-- To view scheduled jobs
SELECT * FROM cron.job;

-- To unschedule
SELECT cron.unschedule('send-due-date-reminders');
```

**Note:** pg_cron may not be available on all Supabase plans. Check with Supabase support.

### Option 3: Application-Level Cron (Node.js)

If you have a backend server:

```javascript
// server.js
const { createClient } = require('@supabase/supabase-js')
const cron = require('node-cron')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Run every hour
cron.schedule('0 * * * *', async () => {
  console.log('Sending due date reminders...')
  
  const { error } = await supabase.rpc('send_due_date_reminders')
  
  if (error) {
    console.error('Error sending reminders:', error)
  } else {
    console.log('Reminders sent successfully')
  }
})
```

### Option 4: Manual Testing

For testing purposes, you can manually trigger reminders:

```sql
-- Run this in Supabase SQL Editor
SELECT send_due_date_reminders();

-- Check notifications created
SELECT * FROM notifications 
WHERE type = 'task_due_reminder' 
ORDER BY created_at DESC 
LIMIT 10;
```

## Frontend Updates

### NotificationBell Component

**Updated Features:**
- ✅ New icons: `UserPlus` (task assigned), `AlertTriangle` (due reminder)
- ✅ Color coding: Blue for assignments, Orange for reminders
- ✅ Enhanced payload display showing task type, priority, and due date
- ✅ Proper TypeScript interfaces updated

**No additional frontend changes required!** The notification system automatically handles the new notification types.

## Testing

### Test Task Assignment Notifications

**1. Create a task with an assignee:**
```sql
INSERT INTO tasks (
  title,
  project_id,
  assignee_id,
  created_by,
  priority,
  task_type,
  due_date,
  status
)
VALUES (
  'Test Task Assignment',
  '[project-id]',
  '[user-id]',
  '[creator-id]',
  'high',
  'task',
  NOW() + INTERVAL '2 days',
  'todo'
);
```

**2. Check notification was created:**
```sql
SELECT * FROM notifications 
WHERE type = 'task_assigned' 
  AND user_id = '[user-id]'
ORDER BY created_at DESC 
LIMIT 1;
```

**3. Verify in UI:**
- Log in as the assigned user
- Check bell icon for new notification
- Verify it shows task details

### Test Task Reassignment

**1. Reassign a task:**
```sql
UPDATE tasks 
SET assignee_id = '[new-user-id]'
WHERE id = '[task-id]';
```

**2. Check notification:**
- New assignee should receive notification
- Message should say "You have been reassigned to..."

### Test Due Date Reminders

**1. Create a task due soon:**
```sql
INSERT INTO tasks (
  title,
  project_id,
  assignee_id,
  priority,
  due_date,
  status
)
VALUES (
  'Test Due Date Reminder',
  '[project-id]',
  '[user-id]',
  'high',
  NOW() + INTERVAL '5 hours',
  'todo'
);
```

**2. Manually trigger reminders:**
```sql
SELECT send_due_date_reminders();
```

**3. Check notification:**
```sql
SELECT * FROM notifications 
WHERE type = 'task_due_reminder' 
  AND user_id = '[user-id]'
ORDER BY created_at DESC;
```

**4. Verify urgency level:**
- < 6 hours: Should show "⚠️ Urgent:"
- < 12 hours: Should show "Reminder:"
- < 24 hours: Should show "Reminder:"

### Test Anti-Spam Protection

**1. Trigger reminders twice within 12 hours:**
```sql
SELECT send_due_date_reminders();
-- Wait a minute
SELECT send_due_date_reminders();
```

**2. Verify only one notification created:**
```sql
SELECT COUNT(*) FROM notifications 
WHERE type = 'task_due_reminder' 
  AND user_id = '[user-id]'
  AND (payload->>'task_id')::uuid = '[task-id]'
  AND created_at > NOW() - INTERVAL '1 hour';
-- Should return 1, not 2
```

## Notification Flow Diagrams

### Task Assignment Flow
```
Task Created/Updated with Assignee
    ↓
Trigger: task_assigned_trigger fires
    ↓
Function: notify_task_assigned()
    ↓
Gets task details and assigner name
    ↓
Creates notification for assignee
    ↓
Supabase realtime broadcasts
    ↓
NotificationBell receives update
    ↓
User sees notification instantly
```

### Due Date Reminder Flow
```
Cron job runs (every hour)
    ↓
Calls: send_due_date_reminders()
    ↓
Queries tasks due within 24 hours
    ↓
Filters: not done, not recently reminded
    ↓
For each task:
  - Calculate hours until due
  - Determine urgency level
  - Create notification
    ↓
Supabase realtime broadcasts
    ↓
Users see reminders instantly
```

## Notification Details

### Task Assignment Notification Payload
```json
{
  "task_id": "uuid",
  "task_title": "Task name",
  "task_type": "task" | "assignment",
  "priority": "low" | "medium" | "high" | "urgent",
  "due_date": "2025-01-30T12:00:00Z",
  "assigned_by": "uuid",
  "assigner_name": "John Doe",
  "message": "You have been assigned to \"Task name\""
}
```

### Due Date Reminder Notification Payload
```json
{
  "task_id": "uuid",
  "task_title": "Task name",
  "task_type": "task" | "assignment",
  "priority": "low" | "medium" | "high" | "urgent",
  "due_date": "2025-01-30T12:00:00Z",
  "hours_until_due": 5.5,
  "message": "⚠️ Urgent: \"Task name\" is due in less than 6 hours!"
}
```

## Performance Considerations

### Database Indexes

The migration creates an index to speed up due date queries:
```sql
CREATE INDEX idx_tasks_due_date_assignee 
ON tasks(due_date, assignee_id) 
WHERE status NOT IN ('done', 'submitted') AND due_date IS NOT NULL;
```

**Query Performance:**
- ✅ Efficiently finds tasks due soon
- ✅ Filters completed tasks at index level
- ✅ Only includes tasks with due dates and assignees

### Anti-Spam Protection

**12-Hour Cooldown:**
- Prevents duplicate reminders within 12 hours
- Checks notification history before creating new ones
- Reduces notification fatigue

**Optimal Scheduling:**
- Run reminders every 1 hour (recommended)
- Can run more frequently if needed (every 30 minutes)
- Don't run more than every 15 minutes (unnecessary)

## Troubleshooting

### Task Assignment Notifications Not Appearing

**1. Check trigger exists:**
```sql
SELECT tgname, tgenabled 
FROM pg_trigger 
WHERE tgname = 'task_assigned_trigger';
```

**2. Test trigger manually:**
```sql
-- Assign a task
UPDATE tasks 
SET assignee_id = '[user-id]' 
WHERE id = '[task-id]';

-- Check notification
SELECT * FROM notifications 
WHERE type = 'task_assigned' 
ORDER BY created_at DESC 
LIMIT 1;
```

**3. Check function exists:**
```sql
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname = 'notify_task_assigned';
```

### Due Date Reminders Not Sending

**1. Check function exists:**
```sql
SELECT proname 
FROM pg_proc 
WHERE proname = 'send_due_date_reminders';
```

**2. Manually test function:**
```sql
SELECT send_due_date_reminders();
```

**3. Check if tasks exist that should trigger reminders:**
```sql
SELECT 
  t.id,
  t.title,
  t.assignee_id,
  t.due_date,
  t.status,
  (t.due_date - NOW()) as time_until_due
FROM tasks t
WHERE t.assignee_id IS NOT NULL
  AND t.status NOT IN ('done', 'submitted')
  AND t.due_date IS NOT NULL
  AND t.due_date > NOW()
  AND t.due_date <= NOW() + INTERVAL '24 hours';
```

**4. Check for recent reminders (might be in cooldown):**
```sql
SELECT * FROM notifications 
WHERE type = 'task_due_reminder' 
  AND created_at > NOW() - INTERVAL '12 hours'
ORDER BY created_at DESC;
```

### Cron Job Not Running

**GitHub Actions:**
- Check Actions tab in GitHub repository
- Verify secrets are set correctly
- Check workflow logs for errors

**External Cron Services:**
- Verify URL is correct
- Check service logs
- Ensure authentication is working

**pg_cron:**
- Check if pg_cron extension is enabled
- Verify job is scheduled: `SELECT * FROM cron.job;`
- Check pg_cron logs

## Best Practices

### Reminder Scheduling

**Recommended:**
- ✅ Run every hour for most applications
- ✅ Consistent timing (e.g., on the hour)
- ✅ Monitor for errors

**Avoid:**
- ❌ Running every minute (unnecessary)
- ❌ Inconsistent scheduling
- ❌ No error monitoring

### Notification Management

**For Users:**
- They can mark notifications as read
- They can delete notifications
- Unread count updates automatically

**For Admins:**
- Monitor notification volume
- Adjust reminder frequency if needed
- Clean up old notifications periodically

### Database Maintenance

**Periodic Cleanup (Optional):**
```sql
-- Archive notifications older than 30 days
DELETE FROM notifications 
WHERE created_at < NOW() - INTERVAL '30 days'
  AND read_at IS NOT NULL;
```

## Security

**Database Functions:**
- Run with `SECURITY DEFINER`
- Only authorized triggers can execute
- Users cannot directly call notification creation functions

**Row Level Security:**
- Users only see their own notifications
- RLS policies prevent unauthorized access

## Future Enhancements

Potential improvements:
- 📧 Email notifications for critical reminders
- 🔔 Push notifications for mobile
- ⚙️ User preferences for reminder frequency
- 📊 Notification analytics
- 🎯 Smart reminder timing based on user patterns

## Summary

✅ **Task Assignment Notifications** - Automatic, instant  
✅ **Due Date Reminders** - Scheduled, intelligent  
✅ **Anti-Spam Protection** - Built-in cooldown  
✅ **Visual Distinction** - Color-coded by type  
✅ **Detailed Information** - Task type, priority, due date  
✅ **Production Ready** - Tested and optimized  

**Next Steps:**
1. Apply database migration
2. Set up cron job for reminders
3. Test both notification types
4. Monitor notification delivery

---

**Version:** 2.0.0  
**Last Updated:** January 30, 2025  
**Migration File:** `20250130000002_add_task_assignment_notifications.sql`

