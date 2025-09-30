import { supabase } from '@/integrations/supabase/client';
import { todayInMY } from './tz';

export interface AttendanceCheckIn {
  id: string;
  org_id: string;
  user_id: string;
  clock_in_at: string;
  local_date: string;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface CheckInWithUser extends AttendanceCheckIn {
  user: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
  };
}

/**
 * Check if a user has already checked in today for a specific organization
 * @param orgId - Organization ID
 * @param userId - User ID
 * @param dateISO - Date in YYYY-MM-DD format (defaults to today in MY timezone)
 * @returns Promise with count result
 */
export async function hasCheckedInToday(
  orgId: string, 
  userId: string, 
  dateISO: string = todayInMY()
) {
  return supabase
    .from('attendance_checkins')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .eq('local_date', dateISO);
}

/**
 * Create a daily check-in for a user
 * @param orgId - Organization ID
 * @param userId - User ID
 * @param source - Source of check-in (default: 'web')
 * @returns Promise with check-in data
 */
export async function createCheckIn(
  orgId: string, 
  userId: string, 
  source: string = 'web'
) {
  return supabase
    .from('attendance_checkins')
    .insert({ 
      org_id: orgId, 
      user_id: userId, 
      source 
    })
    .select()
    .single();
}

/**
 * Create a daily check-in using the database function (handles duplicates gracefully)
 * @param orgId - Organization ID
 * @param userId - User ID
 * @param source - Source of check-in (default: 'web')
 * @returns Promise with check-in data
 */
export async function createDailyCheckIn(
  orgId: string, 
  userId: string, 
  source: string = 'web'
) {
  return supabase
    .rpc('create_daily_checkin', {
      p_org_id: orgId,
      p_user_id: userId,
      p_source: source
    });
}

/**
 * Get check-ins for a specific organization and date
 * @param orgId - Organization ID
 * @param dateISO - Date in YYYY-MM-DD format
 * @returns Promise with check-ins data
 */
export async function getCheckInsForDate(
  orgId: string, 
  dateISO: string
) {
  return supabase
    .from('attendance_checkins')
    .select(`
      id,
      clock_in_at,
      local_date,
      source,
      user_id
    `)
    .eq('org_id', orgId)
    .eq('local_date', dateISO)
    .order('clock_in_at', { ascending: true });
}

/**
 * Get check-ins for a specific organization within a date range
 * @param orgId - Organization ID
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @returns Promise with check-ins data
 */
export async function getCheckInsForDateRange(
  orgId: string, 
  startDate: string, 
  endDate: string
) {
  return supabase
    .from('attendance_checkins')
    .select(`
      id,
      clock_in_at,
      local_date,
      source,
      user_id
    `)
    .eq('org_id', orgId)
    .gte('local_date', startDate)
    .lte('local_date', endDate)
    .order('clock_in_at', { ascending: true });
}

/**
 * Get check-ins for a specific user within a date range
 * @param userId - User ID
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @returns Promise with check-ins data
 */
export async function getUserCheckIns(
  userId: string, 
  startDate: string, 
  endDate: string
) {
  return supabase
    .from('attendance_checkins')
    .select(`
      id,
      clock_in_at,
      local_date,
      source,
      org_id,
      organization:organizations!inner(
        id,
        name,
        logo_url
      )
    `)
    .eq('user_id', userId)
    .gte('local_date', startDate)
    .lte('local_date', endDate)
    .order('clock_in_at', { ascending: true });
}

/**
 * Subscribe to real-time check-ins for an organization and date
 * @param orgId - Organization ID
 * @param dateISO - Date in YYYY-MM-DD format
 * @param onInsert - Callback for insert events
 * @param onUpdate - Callback for update events
 * @param onDelete - Callback for delete events
 * @returns Supabase realtime channel
 */
export function subscribeToCheckIns(
  orgId: string,
  dateISO: string,
  onInsert?: (payload: any) => void,
  onUpdate?: (payload: any) => void,
  onDelete?: (payload: any) => void
) {
  const channel = supabase
    .channel(`checkins:${orgId}:${dateISO}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'attendance_checkins',
        filter: `org_id=eq.${orgId}`
      },
      (payload) => {
        if (onInsert) onInsert(payload);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'attendance_checkins',
        filter: `org_id=eq.${orgId}`
      },
      (payload) => {
        if (onUpdate) onUpdate(payload);
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'attendance_checkins',
        filter: `org_id=eq.${orgId}`
      },
      (payload) => {
        if (onDelete) onDelete(payload);
      }
    )
    .subscribe();

  return channel;
}

/**
 * Export check-ins data to CSV format
 * @param checkIns - Array of check-ins with user data
 * @returns CSV string
 */
export function exportCheckInsToCSV(checkIns: any[]): string {
  const headers = [
    'Name',
    'Email',
    'Clock-in Time',
    'Date',
    'Source',
    'Relative Time'
  ];

  const rows = checkIns.map(checkIn => [
    checkIn.user?.full_name || 'Unknown',
    checkIn.user?.email || '',
    new Date(checkIn.clock_in_at).toLocaleString('en-US', {
      timeZone: 'Asia/Kuala_Lumpur',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }),
    checkIn.local_date,
    checkIn.source,
    new Date(checkIn.clock_in_at).toLocaleString('en-US', {
      timeZone: 'Asia/Kuala_Lumpur',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(field => `"${field}"`).join(','))
    .join('\n');

  return csvContent;
}

/**
 * Download CSV file
 * @param csvContent - CSV content string
 * @param filename - Filename for download
 */
export function downloadCSV(csvContent: string, filename: string = 'check-ins.csv'): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
