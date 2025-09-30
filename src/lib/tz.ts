/**
 * Timezone utilities for Malaysia (Asia/Kuala_Lumpur)
 */

/**
 * Get today's date in Malaysia timezone as YYYY-MM-DD format
 * @returns Date string in YYYY-MM-DD format for Asia/Kuala_Lumpur timezone
 */
export function todayInMY(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const parts = formatter.formatToParts(now);
  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  const day = parts.find(part => part.type === 'day')?.value;
  
  return `${year}-${month}-${day}`;
}

/**
 * Format a date to Malaysia timezone
 * @param date - Date to format
 * @param options - Intl.DateTimeFormat options
 * @returns Formatted date string
 */
export function formatInMY(
  date: Date | string, 
  options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Kuala_Lumpur',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('en-US', options).format(dateObj);
}

/**
 * Get current time in Malaysia timezone
 * @returns Date object representing current time in Asia/Kuala_Lumpur
 */
export function nowInMY(): Date {
  const now = new Date();
  const myTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" }));
  return myTime;
}

/**
 * Check if a time is after a threshold (e.g., 9:15 AM)
 * @param time - Time to check
 * @param thresholdHour - Hour threshold (24-hour format)
 * @param thresholdMinute - Minute threshold
 * @returns True if time is after threshold
 */
export function isAfterThreshold(
  time: Date | string, 
  thresholdHour: number = 9, 
  thresholdMinute: number = 15
): boolean {
  const timeObj = typeof time === 'string' ? new Date(time) : time;
  const myTime = new Date(timeObj.toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" }));
  
  const hour = myTime.getHours();
  const minute = myTime.getMinutes();
  
  return hour > thresholdHour || (hour === thresholdHour && minute > thresholdMinute);
}

/**
 * Get relative time string (e.g., "9:12 AM", "2 hours ago")
 * @param time - Time to format
 * @returns Relative time string
 */
export function getRelativeTime(time: Date | string): string {
  const timeObj = typeof time === 'string' ? new Date(time) : time;
  const myTime = new Date(timeObj.toLocaleString("en-US", { timeZone: "Asia/Kuala_Lumpur" }));
  
  const now = nowInMY();
  const diffMs = now.getTime() - myTime.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMinutes < 1) {
    return 'Just now';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return formatInMY(myTime, {
      timeZone: 'Asia/Kuala_Lumpur',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }
}

/**
 * Get time in HH:mm format for Malaysia timezone
 * @param time - Time to format
 * @returns Time string in HH:mm format
 */
export function getTimeInMY(time: Date | string): string {
  const timeObj = typeof time === 'string' ? new Date(time) : time;
  return formatInMY(timeObj, {
    timeZone: 'Asia/Kuala_Lumpur',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}
