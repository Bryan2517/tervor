-- Add clock_out_at field to attendance_checkins table
ALTER TABLE public.attendance_checkins
ADD COLUMN clock_out_at timestamp with time zone;

-- Create function to clock out
CREATE OR REPLACE FUNCTION public.clock_out_from_org(p_org_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.attendance_checkins
  SET clock_out_at = now(),
      updated_at = now()
  WHERE org_id = p_org_id
    AND user_id = p_user_id
    AND local_date = timezone('Asia/Kuala_Lumpur', now())::date
    AND clock_out_at IS NULL;
END;
$$;