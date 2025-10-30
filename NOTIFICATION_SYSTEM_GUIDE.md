# Extension Request Notification System

## Overview

This notification system automatically notifies users about extension request events across all dashboards. The system uses database triggers to create notifications and real-time subscriptions to display them instantly.

## Features

### 1. Automatic Notifications

The system creates notifications automatically when:
- **Extension Request Created**: All owners and admins in the organization receive a notification when a worker requests a deadline extension
- **Extension Request Approved**: The requester receives a notification when their extension is approved
- **Extension Request Rejected**: The requester receives a notification when their extension is rejected

### 2. Real-Time Updates

Notifications appear instantly using Supabase real-time subscriptions, so users don't need to refresh their page to see new notifications.

### 3. Notification Management

Users can:
- View all notifications in a dropdown popover
- See unread count badge on the bell icon
- Mark individual notifications as read
- Mark all notifications as read at once
- Delete individual notifications
- See notification timestamps (e.g., "2 hours ago")

### 4. Visual Indicators

Each notification type has a distinct visual appearance:
- **Extension Requested** (for owners/admins): Blue background with calendar clock icon
- **Extension Approved** (for workers): Green background with checkmark icon  
- **Extension Rejected** (for workers): Red background with X icon

## Architecture

### Database Components

#### 1. Notifications Table
Already exists in the database with the following structure:
- `id`: Unique notification ID
- `user_id`: The user who receives the notification
- `type`: Type of notification (extension_requested, extension_approved, extension_rejected)
- `payload`: JSON containing notification details (task title, requester name, decision note, etc.)
- `read_at`: Timestamp when the notification was read (NULL if unread)
- `created_at`: When the notification was created

#### 2. Database Triggers
Located in: `supabase/migrations/20250130000000_create_extension_notification_triggers.sql`

**Functions:**
- `get_task_organization_admins(task_uuid)`: Returns all owners and admins for a task's organization
- `notify_extension_request_created()`: Trigger function that creates notifications for all owners/admins when an extension request is inserted
- `notify_extension_request_decided()`: Trigger function that creates a notification for the requester when their request status changes to approved/rejected

**Triggers:**
- `extension_request_created_trigger`: Fires AFTER INSERT on extension_requests
- `extension_request_decided_trigger`: Fires AFTER UPDATE on extension_requests

### Frontend Components

#### 1. NotificationBell Component
Located in: `src/components/dashboard/shared/NotificationBell.tsx`

**Props:**
- `userId`: The current user's ID

**Features:**
- Fetches notifications on mount
- Subscribes to real-time notification inserts
- Shows unread count badge
- Provides dropdown popover with scrollable notification list
- Handles marking as read and deleting notifications

#### 2. Integration in Dashboards

The NotificationBell component is added to all role-specific dashboards:
- `src/components/dashboard/EmployeeDashboard.tsx`
- `src/components/dashboard/roles/OwnerDashboard.tsx`
- `src/components/dashboard/roles/AdminDashboard.tsx`
- `src/components/dashboard/roles/SupervisorDashboard.tsx`

Each dashboard:
1. Imports the NotificationBell component
2. Fetches the current user's ID on mount
3. Renders the NotificationBell in the header next to other action buttons

## User Flows

### For Workers (Employees/Supervisors)

1. **Request Extension:**
   - Navigate to a project detail page
   - Click "Request Extension" on a task
   - Fill in the new due date and reason
   - Submit the request

2. **Receive Decision Notification:**
   - Bell icon shows unread badge when decision is made
   - Click bell to see notification
   - Notification shows whether approved or rejected
   - Can view decision note if provided by owner/admin
   - Click checkmark to mark as read or trash to delete

### For Owners/Admins

1. **Receive Extension Request:**
   - Bell icon shows unread badge when worker requests extension
   - Click bell to see notification
   - Notification shows task name, requester, and reason
   - Can navigate to Extension Requests page to review

2. **Review Extension Request:**
   - Click "Extension Requests" button in dashboard header
   - See all pending, approved, and rejected requests
   - Click approve or reject button
   - Optionally add decision note
   - Submit decision

3. **Automatic Notification:**
   - System automatically notifies the requester
   - No manual action needed

## Extension Requests Pages

Both owners and admins have access to dedicated extension request management pages:
- Owner: `/owner/extension-requests`
- Admin: `/admin/extension-requests`

**Features:**
- Tabbed interface (Pending, Approved, Rejected)
- Shows task details, current due date, requested due date
- Displays requester information and reason
- Approve/reject buttons with optional decision notes
- Automatically updates task due date when approved

## Database Migration

To apply the notification triggers to your database:

```bash
# Using Supabase CLI
supabase migration up

# Or using the Supabase dashboard
# Upload the migration file: supabase/migrations/20250130000000_create_extension_notification_triggers.sql
```

## Notification Type Enum

The `notification_type` enum has been updated to include:
- `extension_requested` (new)
- `extension_approved`
- `extension_rejected`
- Other types: task_assigned, task_due_changed, task_commented, mention, transfer_approved, transfer_rejected, reward_redeemed, reward_fulfilled, announcement

## Testing

### Manual Testing Steps

1. **Test Extension Request Creation:**
   - Log in as an employee
   - Request an extension on a task
   - Log in as an owner/admin
   - Verify notification appears in bell dropdown
   - Verify unread badge shows correct count

2. **Test Extension Approval:**
   - Log in as owner/admin
   - Go to Extension Requests page
   - Approve a pending request
   - Log back in as the requester
   - Verify approval notification appears
   - Verify task due date is updated

3. **Test Extension Rejection:**
   - Log in as owner/admin
   - Reject a pending request with a decision note
   - Log back in as the requester
   - Verify rejection notification appears
   - Verify decision note is displayed

4. **Test Real-Time Updates:**
   - Open two browser windows (owner and employee accounts)
   - In employee window, request extension
   - Watch owner window for real-time notification appearance
   - Approve in owner window
   - Watch employee window for real-time notification

5. **Test Notification Management:**
   - Mark individual notification as read
   - Mark all as read
   - Delete notifications
   - Verify unread count updates correctly

## Technical Notes

### Performance Considerations

- Notifications are fetched with a limit of 50 most recent
- Real-time subscriptions are scoped to the current user
- Queries use proper indexes on `user_id` and `created_at`

### Security

- Database triggers run with SECURITY DEFINER to ensure proper permissions
- Users can only see their own notifications (enforced by RLS policies on notifications table)
- Notification creation is handled server-side, preventing client manipulation

### Extensibility

The notification system is designed to be easily extended:
- Add new notification types to the enum
- Create new trigger functions for different events
- Update the NotificationBell component to handle new notification types with custom icons and colors

## Troubleshooting

### Notifications Not Appearing

1. Check that the migration has been applied:
   ```sql
   SELECT * FROM pg_proc WHERE proname = 'notify_extension_request_created';
   ```

2. Verify triggers exist:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname LIKE 'extension_request%';
   ```

3. Check notification_type enum includes new types:
   ```sql
   SELECT enumlabel FROM pg_enum WHERE enumtypid = 'notification_type'::regtype;
   ```

### Real-Time Not Working

1. Ensure Supabase realtime is enabled for the notifications table
2. Check browser console for subscription errors
3. Verify user authentication is valid

### Unread Count Incorrect

- Try marking all as read and refreshing the page
- Check for duplicate notifications in the database
- Verify the read_at timestamp is being set correctly

## Future Enhancements

Potential improvements to consider:
1. Email notifications for extension requests
2. Push notifications for mobile devices
3. Notification preferences (enable/disable specific types)
4. Notification sound effects
5. Batch operations (mark multiple as read, bulk delete)
6. Notification history/archive
7. Search and filter notifications
8. Desktop notifications using Web Notifications API

