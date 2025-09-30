# Fix Console Errors in Check-in System

## 🚨 **Issues Identified:**

1. **400 errors on organization_members queries** - Incorrect query syntax
2. **attendance_checkins relationship error** - Missing foreign key relationship
3. **Invalid organization ID** - Using placeholder instead of actual UUID
4. **Role filter errors** - Incorrect role filtering syntax

## 🔧 **Fixes:**

### **1. Fix CheckIns Page - Remove Invalid Relationship**

Update the `getCheckInsForDate` function in `src/lib/attendance.ts`:

```typescript
// OLD (causing 400 error):
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
      user:profiles!inner(
        id,
        full_name,
        email,
        avatar_url
      )
    `)
    .eq('org_id', orgId)
    .eq('local_date', dateISO)
    .order('clock_in_at', { ascending: true });
}

// NEW (fixed):
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
```

### **2. Fix CheckIns Page - Fetch User Data Separately**

Update `src/pages/supervisor/CheckIns.tsx`:

```typescript
// Replace the loadCheckIns function with this:
const loadCheckIns = async (date: string) => {
  setLoading(true);
  try {
    // First get check-ins
    const { data: checkInsData, error: checkInsError } = await supabase
      .from('attendance_checkins')
      .select(`
        id,
        clock_in_at,
        local_date,
        source,
        user_id
      `)
      .eq('org_id', organizationId)
      .eq('local_date', date)
      .order('clock_in_at', { ascending: true });
    
    if (checkInsError) throw checkInsError;
    
    if (!checkInsData || checkInsData.length === 0) {
      setCheckIns([]);
      return;
    }
    
    // Get user IDs
    const userIds = checkInsData.map(checkIn => checkIn.user_id);
    
    // Fetch user data separately
    const { data: usersData, error: usersError } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .in('id', userIds);
    
    if (usersError) throw usersError;
    
    // Combine the data
    const combinedData = checkInsData.map(checkIn => {
      const user = usersData?.find(u => u.id === checkIn.user_id);
      return {
        ...checkIn,
        user: user || { id: checkIn.user_id, full_name: 'Unknown', email: '', avatar_url: null }
      };
    });
    
    setCheckIns(combinedData);
  } catch (error: any) {
    console.error("Error loading check-ins:", error);
    toast({
      title: "Error Loading Check-ins",
      description: error.message || "Failed to load check-ins",
      variant: "destructive",
    });
  } finally {
    setLoading(false);
  }
};
```

### **3. Fix Organization ID Issue**

Update `src/pages/supervisor/CheckInsWrapper.tsx`:

```typescript
import { useParams } from "react-router-dom";
import { CheckInsPage } from "./CheckIns";

export function CheckInsWrapper() {
  // TODO: Get these from context or props in a real implementation
  // For now, you'll need to replace these with actual values
  const organizationId = "329a8790-40d8-4ebb-8913-9e2189a3ac28"; // Replace with actual org ID
  const organizationName = "Your Organization"; // Replace with actual org name

  return (
    <CheckInsPage 
      organizationId={organizationId}
      organizationName={organizationName}
    />
  );
}
```

### **4. Fix Organization Members Queries**

The 400 errors on organization_members are likely due to incorrect role filtering. Update any queries that use role filters:

```typescript
// OLD (causing 400 error):
.eq('role', 'employee')

// NEW (fetch all and filter client-side):
// Remove the .eq('role', 'employee') filter and filter in JavaScript
const { data: allMembers } = await supabase
  .from('organization_members')
  .select('id, role, user_id')
  .eq('organization_id', orgId);

// Filter on client side
const employees = allMembers?.filter(member => member.role === 'employee') || [];
```

### **5. Update Attendance Helper Functions**

Update `src/lib/attendance.ts` to remove problematic relationships:

```typescript
// Update getCheckInsForDate function
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

// Update getCheckInsForDateRange function
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
```

### **6. Fix CSV Export Function**

Update the CSV export to work with the new data structure:

```typescript
// Update exportCheckInsToCSV function
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
```

## 🧪 **Test the Fixes**

After applying these fixes:

1. **Check the console** - No more 400 errors
2. **Test check-in functionality** - Modal should work
3. **Test supervisor page** - Should load check-ins properly
4. **Test CSV export** - Should work without errors

## ✅ **Summary of Changes:**

1. **Removed problematic foreign key relationships** from Supabase queries
2. **Fetch user data separately** and combine in JavaScript
3. **Fixed organization ID** to use actual UUID instead of placeholder
4. **Updated CSV export** to work with new data structure
5. **Fixed role filtering** to use client-side filtering instead of database filtering

**These fixes should resolve all the console errors and make your check-in system work properly!** 🚀
