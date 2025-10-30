-- Migration: Add RLS policies for notifications table
-- Ensures users can only see and manage their own notifications

-- Enable RLS on notifications table if not already enabled
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON notifications;
DROP POLICY IF EXISTS "System can insert notifications for any user" ON notifications;

-- Policy: Users can view their own notifications
CREATE POLICY "Users can view their own notifications"
ON notifications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Users can update their own notifications (for marking as read)
CREATE POLICY "Users can update their own notifications"
ON notifications
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications"
ON notifications
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Policy: System/triggers can insert notifications for any user
-- This allows database triggers to create notifications
CREATE POLICY "System can insert notifications for any user"
ON notifications
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id 
ON notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read_at 
ON notifications(user_id, read_at);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at 
ON notifications(created_at DESC);

-- Add comment for documentation
COMMENT ON TABLE notifications IS 
  'Stores user notifications with RLS policies ensuring users can only access their own notifications';

