import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, Calendar, LogIn, LogOut, TrendingUp } from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";

interface ClockInRecord {
  id: string;
  user_id: string;
  org_id: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  local_date: string;
  source: string | null;
  status?: "early" | "on-time" | "late";
  hasOvertime?: boolean;
}

interface WorkHoursConfig {
  work_start_time: string;
  work_end_time: string;
  early_threshold_minutes: number;
  late_threshold_minutes: number;
}

export default function EmployeeTimeManagement() {
  const navigate = useNavigate();
  const { organization } = useOrganization();
  const [clockInRecords, setClockInRecords] = useState<ClockInRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<ClockInRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"all" | "early" | "on-time" | "late" | "overtime" | "absent">("all");
  const [workHours, setWorkHours] = useState<WorkHoursConfig>({
    work_start_time: "09:00:00",
    work_end_time: "17:00:00",
    early_threshold_minutes: 15,
    late_threshold_minutes: 15,
  });

  useEffect(() => {
    if (organization) {
      fetchWorkHours();
      fetchClockInHistory();
    }
  }, [organization]);

  useEffect(() => {
    applyFilter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clockInRecords, activeFilter, organization]);

  const fetchWorkHours = async () => {
    try {
      if (!organization) return;

      const { data, error } = await supabase
        .from("organizations")
        .select("work_start_time, work_end_time, early_threshold_minutes, late_threshold_minutes")
        .eq("id", organization.id)
        .single();

      if (error || !data || !('work_start_time' in data)) {
        return;
      }

      setWorkHours({
        work_start_time: (data as any).work_start_time || "09:00:00",
        work_end_time: (data as any).work_end_time || "17:00:00",
        early_threshold_minutes: (data as any).early_threshold_minutes || 15,
        late_threshold_minutes: (data as any).late_threshold_minutes || 15,
      });
    } catch (error) {
      console.error("Error fetching work hours:", error);
    }
  };

  const fetchClockInHistory = async () => {
    if (!organization) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("attendance_checkins")
        .select("*")
        .eq("org_id", organization.id)
        .eq("user_id", user.id)
        .order("local_date", { ascending: false })
        .order("clock_in_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      // Add status and overtime information to each record
      const recordsWithStatus = (data || []).map((record: any) => ({
        ...record,
        status: record.clock_in_at ? getArrivalStatus(record.clock_in_at) : undefined,
        hasOvertime: record.clock_in_at && record.clock_out_at ? checkHasOvertime(record.clock_in_at, record.clock_out_at) : false,
      }));

      setClockInRecords(recordsWithStatus);
    } catch (error) {
      console.error("Error fetching clock-in history:", error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilter = () => {
    let filtered = [...clockInRecords];
    
    switch (activeFilter) {
      case "early":
        filtered = filtered.filter((r) => r.status === "early");
        break;
      case "on-time":
        filtered = filtered.filter((r) => r.status === "on-time");
        break;
      case "late":
        filtered = filtered.filter((r) => r.status === "late");
        break;
      case "overtime":
        filtered = filtered.filter((r) => r.hasOvertime === true);
        break;
      case "absent":
        // For absent, we need to generate dates that should have attendance but don't
        filtered = generateAbsentDays();
        break;
      case "all":
      default:
        break;
    }

    setFilteredRecords(filtered);
  };

  const generateAbsentDays = () => {
    // Get the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const today = new Date().toISOString().split('T')[0];

    const dateRange: string[] = [];
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      dateRange.push(date.toISOString().split('T')[0]);
    }

    // Find dates where there are no records
    const recordsDates = clockInRecords.map((r) => r.local_date);
    const absentDates = dateRange.filter((date) => !recordsDates.includes(date));

    // Only consider past dates or today after work end time
    const now = new Date();
    const [endHours, endMinutes] = workHours.work_end_time.split(':').map(Number);
    const workEndMinutes = endHours * 60 + endMinutes;

    return absentDates
      .filter((date) => {
        const dateObj = new Date(date);
        const isToday = date === today;
        const isPastDate = dateObj.toISOString().split('T')[0] < today;
        const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();
        const isAfterWorkEnd = isToday && currentTimeMinutes >= workEndMinutes;

        return isPastDate || isAfterWorkEnd;
      })
      .map((date) => ({
        id: `absent-${date}`,
        user_id: '',
        org_id: organization?.id || '',
        clock_in_at: null,
        clock_out_at: null,
        local_date: date,
        source: null,
        status: 'late' as const,
      }));
  };

  const getArrivalStatus = (clockInTime?: string): "early" | "on-time" | "late" => {
    if (!clockInTime) return "late";
    
    const clockIn = new Date(clockInTime);
    const workStart = new Date(clockIn);
    
    const [hours, minutes] = workHours.work_start_time.split(':').map(Number);
    workStart.setHours(hours, minutes, 0, 0);

    const diffMinutes = (clockIn.getTime() - workStart.getTime()) / (1000 * 60);

    if (diffMinutes <= -workHours.early_threshold_minutes) return "early";
    if (diffMinutes <= workHours.late_threshold_minutes) return "on-time";
    return "late";
  };

  const checkHasOvertime = (clockInTime: string, clockOutTime: string): boolean => {
    const clockOut = new Date(clockOutTime);
    const workEnd = new Date(clockOut);
    
    const [hours, minutes] = workHours.work_end_time.split(':').map(Number);
    workEnd.setHours(hours, minutes, 0, 0);

    return clockOut.getTime() > workEnd.getTime();
  };

  const formatDateTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-MY', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  };

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp).toLocaleTimeString('en-MY', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calculateDuration = (clockIn: string | null, clockOut: string | null) => {
    if (!clockIn || !clockOut) return "Still clocked in";
    
    const inTime = new Date(clockIn).getTime();
    const outTime = new Date(clockOut).getTime();
    const durationMs = outTime - inTime;
    
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold">Clock In History</h1>
              <p className="text-sm text-muted-foreground">View your attendance history</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  My Attendance History
                </CardTitle>
                <CardDescription>
                  Last {filteredRecords.length} clock-in records
                </CardDescription>
              </div>
              {/* Filter Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant={activeFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveFilter("all")}
                >
                  All
                </Button>
                <Button
                  variant={activeFilter === "early" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveFilter("early")}
                >
                  Early
                </Button>
                <Button
                  variant={activeFilter === "on-time" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveFilter("on-time")}
                >
                  On Time
                </Button>
                <Button
                  variant={activeFilter === "late" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveFilter("late")}
                >
                  Late
                </Button>
                <Button
                  variant={activeFilter === "overtime" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveFilter("overtime")}
                >
                  OT
                </Button>
                <Button
                  variant={activeFilter === "absent" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveFilter("absent")}
                >
                  Absent
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredRecords.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground font-medium mb-2">No attendance records</p>
                  <p className="text-sm text-muted-foreground">
                    {activeFilter === "all" 
                      ? "Your clock-in history will appear here" 
                      : `No ${activeFilter} records found`}
                  </p>
                </div>
              ) : (
                filteredRecords.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          {record.clock_in_at ? (
                            <>
                              <p className="font-semibold text-lg">
                                {new Date(record.local_date).toLocaleDateString('en-MY', {
                                  weekday: 'long',
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </p>
                              {record.status === "early" && (
                                <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                                  Early
                                </Badge>
                              )}
                              {record.status === "on-time" && (
                                <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20">
                                  On Time
                                </Badge>
                              )}
                              {record.status === "late" && (
                                <Badge variant="secondary" className="bg-red-500/10 text-red-600 border-red-500/20">
                                  Late
                                </Badge>
                              )}
                              {!record.clock_out_at && (
                                <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20">
                                  Active
                                </Badge>
                              )}
                              {record.hasOvertime && (
                                <Badge variant="secondary" className="bg-orange-500/10 text-orange-600 border-orange-500/20">
                                  <TrendingUp className="w-3 h-3 mr-1" />
                                  OT
                                </Badge>
                              )}
                            </>
                          ) : (
                            <>
                              <p className="font-semibold text-lg text-muted-foreground">
                                {new Date(record.local_date).toLocaleDateString('en-MY', {
                                  weekday: 'long',
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </p>
                              <Badge variant="destructive">
                                Absent
                              </Badge>
                            </>
                          )}
                        </div>
                        {record.clock_in_at ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-sm">
                              <LogIn className="w-4 h-4 text-primary" />
                              <span className="text-muted-foreground">Clock In:</span>
                              <span className="font-medium">{formatTime(record.clock_in_at)}</span>
                            </div>
                            {record.clock_out_at ? (
                              <div className="flex items-center gap-2 text-sm">
                                <LogOut className="w-4 h-4 text-orange-500" />
                                <span className="text-muted-foreground">Clock Out:</span>
                                <span className="font-medium">{formatTime(record.clock_out_at)}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 text-sm text-green-600">
                                <LogOut className="w-4 h-4" />
                                <span className="font-medium">Currently clocked in</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">
                            No attendance recorded
                          </div>
                        )}
                      </div>
                    </div>
                    {record.clock_in_at && (
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary">{calculateDuration(record.clock_in_at, record.clock_out_at)}</p>
                        {record.clock_out_at && (
                          <p className="text-xs text-muted-foreground mt-1">Duration</p>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

