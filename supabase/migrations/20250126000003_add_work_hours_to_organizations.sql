-- Add work hours fields to organizations table
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS work_start_time TIME DEFAULT '09:00:00',
ADD COLUMN IF NOT EXISTS work_end_time TIME DEFAULT '17:00:00',
ADD COLUMN IF NOT EXISTS early_threshold_minutes INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS late_threshold_minutes INTEGER DEFAULT 15;

-- Add comments to describe the fields
COMMENT ON COLUMN public.organizations.work_start_time IS 'Standard work start time for the organization';
COMMENT ON COLUMN public.organizations.work_end_time IS 'Standard work end time for the organization';
COMMENT ON COLUMN public.organizations.early_threshold_minutes IS 'Minutes before work start time to be considered early';
COMMENT ON COLUMN public.organizations.late_threshold_minutes IS 'Minutes after work start time to be considered late';

