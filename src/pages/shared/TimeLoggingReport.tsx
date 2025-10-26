import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/enhanced-card";
import { Button } from "@/components/ui/enhanced-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";
import { 
  ArrowLeft, 
  Clock, 
  Calendar, 
  TrendingUp, 
  AlertCircle,
  CheckCircle2,
  XCircle,
  Download,
  Search,
  Filter,
  BarChart3
} from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Legend } from "recharts";

interface AttendanceRecord {
  id: string;
  user_id: string;
  clock_in_at: string;
  clock_out_at?: string;
  local_date: string;
  users: {
    full_name?: string;
    email: string;
  };
  role?: string;
}

interface AttendanceStats {
  totalPresent: number;
  earlyArrivals: number;
  onTime: number;
  late: number;
  overtime: number;
  totalMembers: number;
  absent: number;
  attended: number;
}

interface WorkHoursConfig {
  work_start_time: string;
  work_end_time: string;
  early_threshold_minutes: number;
  late_threshold_minutes: number;
}

export function TimeLoggingReport() {
  const { organization } = useOrganization();
  const { toast } = useToast();
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<AttendanceRecord[]>([]);
  const [stats, setStats] = useState<AttendanceStats>({
    totalPresent: 0,
    earlyArrivals: 0,
    onTime: 0,
    late: 0,
    overtime: 0,
    totalMembers: 0,
    absent: 0,
    attended: 0,
  });
  const [filteredStats, setFilteredStats] = useState<AttendanceStats>({
    totalPresent: 0,
    earlyArrivals: 0,
    onTime: 0,
    late: 0,
    overtime: 0,
    totalMembers: 0,
    absent: 0,
    attended: 0,
  });
  const [workHours, setWorkHours] = useState<WorkHoursConfig>({
    work_start_time: "09:00:00",
    work_end_time: "17:00:00",
    early_threshold_minutes: 15,
    late_threshold_minutes: 15,
  });
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterRole, setFilterRole] = useState("all");
  const [allMembers, setAllMembers] = useState<any[]>([]);

  useEffect(() => {
    if (organization) {
      fetchWorkHours();
      fetchAttendanceData();
    }
  }, [organization, selectedDate]);

  useEffect(() => {
    applyFilters();
  }, [attendanceRecords, searchQuery, filterStatus, filterRole]);

  const fetchWorkHours = async () => {
    try {
      if (!organization) return;

      const { data, error } = await supabase
        .from("organizations")
        .select("work_start_time, work_end_time, early_threshold_minutes, late_threshold_minutes")
        .eq("id", organization.id)
        .single();

      if (error) {
        // Columns don't exist yet, use defaults
        console.log("Work hours columns not found, using defaults");
        return;
      }

      if (data && 'work_start_time' in data) {
        setWorkHours({
          work_start_time: (data as any).work_start_time || "09:00:00",
          work_end_time: (data as any).work_end_time || "17:00:00",
          early_threshold_minutes: (data as any).early_threshold_minutes || 15,
          late_threshold_minutes: (data as any).late_threshold_minutes || 15,
        });
      }
    } catch (error) {
      console.error("Error fetching work hours:", error);
      // Keep default values on error
    }
  };

  const fetchAttendanceData = async () => {
    try {
      if (!organization) return;
      setLoading(true);

      // Fetch all organization members with their roles
      const { data: membersData, error: membersError } = await supabase
        .from("organization_members")
        .select("user_id, role")
        .eq("organization_id", organization.id);

      if (membersError) throw membersError;

      // Fetch user details for all members
      if (membersData && membersData.length > 0) {
        const memberUserIds = membersData.map((m) => m.user_id);
        const { data: allUsersData } = await supabase
          .from("users")
          .select("id, email, full_name")
          .in("id", memberUserIds);

        const members = membersData.map((member) => ({
          user_id: member.user_id,
          role: member.role,
          users: allUsersData?.find((u) => u.id === member.user_id) || {
            email: "Unknown",
            full_name: null,
          },
        }));

        setAllMembers(members);
      }

      const totalMembers = membersData?.length || 0;

      // Fetch attendance records for the selected date
      const { data: attendanceData, error: attendanceError } = await supabase
        .from("attendance_checkins")
        .select("*")
        .eq("org_id", organization.id)
        .eq("local_date", selectedDate)
        .order("clock_in_at", { ascending: true });

      if (attendanceError) throw attendanceError;

      if (attendanceData && attendanceData.length > 0) {
        // Fetch user details for each attendance record
        const userIds = attendanceData.map((record) => record.user_id);
        const { data: usersData } = await supabase
          .from("users")
          .select("id, email, full_name")
          .in("id", userIds);

        // Fetch role information from organization_members
        const { data: rolesData } = await supabase
          .from("organization_members")
          .select("user_id, role")
          .eq("organization_id", organization.id)
          .in("user_id", userIds);

        // Map user data and role to attendance records
        const recordsWithUsers = attendanceData.map((record) => ({
          ...record,
          users: usersData?.find((u) => u.id === record.user_id) || { 
            email: "Unknown", 
            full_name: null 
          },
          role: rolesData?.find((r) => r.user_id === record.user_id)?.role || "employee",
        }));

        setAttendanceRecords(recordsWithUsers);
        calculateStats(recordsWithUsers, setStats, totalMembers);
        calculateStats(recordsWithUsers, setFilteredStats, totalMembers);
      } else {
        setAttendanceRecords([]);
        calculateStats([], setStats, totalMembers);
        calculateStats([], setFilteredStats, totalMembers);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch attendance data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (
    records: AttendanceRecord[], 
    setStatsFn: React.Dispatch<React.SetStateAction<AttendanceStats>> = setStats,
    totalMembers: number = 0
  ) => {
    let earlyArrivals = 0;
    let onTime = 0;
    let late = 0;
    let overtime = 0;

    records.forEach((record) => {
      const status = getArrivalStatus(record.clock_in_at);
      if (status === "early") earlyArrivals++;
      else if (status === "on-time") onTime++;
      else if (status === "late") late++;

      if (record.clock_out_at && hasOvertime(record.clock_in_at, record.clock_out_at)) {
        overtime++;
      }
    });

    const totalPresent = records.length;
    const absent = totalMembers - totalPresent;
    const attended = earlyArrivals + onTime; // Those who came on time or early

    setStatsFn({
      totalPresent,
      earlyArrivals,
      onTime,
      late,
      overtime,
      totalMembers,
      absent,
      attended,
    });
  };

  const getArrivalStatus = (clockInTime: string): "early" | "on-time" | "late" => {
    const clockIn = new Date(clockInTime);
    const workStart = new Date(clockIn);
    
    // Parse work_start_time (format: "HH:MM:SS")
    const [hours, minutes] = workHours.work_start_time.split(':').map(Number);
    workStart.setHours(hours, minutes, 0, 0);

    const diffMinutes = (clockIn.getTime() - workStart.getTime()) / (1000 * 60);

    if (diffMinutes <= -workHours.early_threshold_minutes) return "early";
    if (diffMinutes <= workHours.late_threshold_minutes) return "on-time";
    return "late";
  };

  const hasOvertime = (clockInTime: string, clockOutTime: string): boolean => {
    const clockOut = new Date(clockOutTime);
    const workEnd = new Date(clockOut);
    
    // Parse work_end_time (format: "HH:MM:SS")
    const [hours, minutes] = workHours.work_end_time.split(':').map(Number);
    workEnd.setHours(hours, minutes, 0, 0);

    // Check if clock out time is after work end time
    return clockOut.getTime() > workEnd.getTime();
  };

  const calculateWorkHours = (clockInTime: string, clockOutTime?: string): string => {
    if (!clockOutTime) return "Still working";
    
    const clockIn = new Date(clockInTime);
    const clockOut = new Date(clockOutTime);
    const hoursWorked = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
    
    const hours = Math.floor(hoursWorked);
    const minutes = Math.round((hoursWorked - hours) * 60);
    
    return `${hours}h ${minutes}m`;
  };

  const getStatusBadge = (status: "early" | "on-time" | "late") => {
    switch (status) {
      case "early":
        return <Badge className="bg-blue-500"><CheckCircle2 className="w-3 h-3 mr-1" />Early</Badge>;
      case "on-time":
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />On Time</Badge>;
      case "late":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Late</Badge>;
    }
  };

  const applyFilters = () => {
    let filtered = [...attendanceRecords];
    let filteredMembers = [...allMembers];

    // Role filter on members
    if (filterRole !== "all") {
      filteredMembers = filteredMembers.filter((member) => member.role === filterRole);
    }

    // Search filter on members
    if (searchQuery) {
      filteredMembers = filteredMembers.filter((member) =>
        member.users.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.users.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Calculate filtered total members
    const filteredTotalMembers = filteredMembers.length;

    // Apply filters to attendance records
    // Search filter
    if (searchQuery) {
      filtered = filtered.filter((record) =>
        record.users.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        record.users.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Status filter
    if (filterStatus !== "all") {
      if (filterStatus === "absent") {
        // Absent people don't have attendance records, so show empty
        filtered = [];
      } else {
        filtered = filtered.filter((record) => {
          const status = getArrivalStatus(record.clock_in_at);
          return status === filterStatus;
        });
      }
    }

    // Role filter
    if (filterRole !== "all") {
      filtered = filtered.filter((record) => record.role === filterRole);
    }

    setFilteredRecords(filtered);
    calculateStats(filtered, setFilteredStats, filteredTotalMembers);
  };

  const exportToCSV = () => {
    const headers = ["Name", "Email", "Role", "Clock In", "Clock Out", "Status", "Hours Worked", "Overtime"];
    const rows = filteredRecords.map((record) => {
      const status = getArrivalStatus(record.clock_in_at);
      const hoursWorked = calculateWorkHours(record.clock_in_at, record.clock_out_at);
      const overtime = record.clock_out_at && hasOvertime(record.clock_in_at, record.clock_out_at) ? "Yes" : "No";
      
      return [
        record.users.full_name || "N/A",
        record.users.email,
        (record.role || "employee").charAt(0).toUpperCase() + (record.role || "employee").slice(1),
        format(new Date(record.clock_in_at), "HH:mm:ss"),
        record.clock_out_at ? format(new Date(record.clock_out_at), "HH:mm:ss") : "Still working",
        status,
        hoursWorked,
        overtime,
      ].join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_report_${selectedDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "Attendance report exported successfully",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>No organization selected</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Time Logging Report</h1>
                <p className="text-sm text-muted-foreground">
                  Monitor attendance and work hours
                </p>
              </div>
            </div>
            <Button onClick={exportToCSV}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Members</p>
                  <p className="text-2xl font-bold">{filteredStats.totalMembers}</p>
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Attended</p>
                  <p className="text-2xl font-bold text-green-500">{filteredStats.attended}</p>
                  {filteredStats.totalPresent !== stats.totalPresent && (
                    <p className="text-xs text-muted-foreground">of {stats.attended} total</p>
                  )}
                </div>
                <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Late</p>
                  <p className="text-2xl font-bold text-warning">{filteredStats.late}</p>
                  {filteredStats.totalPresent !== stats.totalPresent && (
                    <p className="text-xs text-muted-foreground">of {stats.late} total</p>
                  )}
                </div>
                <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Absent</p>
                  <p className="text-2xl font-bold text-destructive">{filteredStats.absent}</p>
                  {filteredStats.totalPresent !== stats.totalPresent && (
                    <p className="text-xs text-muted-foreground">of {stats.absent} total</p>
                  )}
                </div>
                <div className="w-12 h-12 bg-destructive/10 rounded-lg flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Early</p>
                  <p className="text-2xl font-bold text-blue-500">{filteredStats.earlyArrivals}</p>
                  {filteredStats.totalPresent !== stats.totalPresent && (
                    <p className="text-xs text-muted-foreground">of {stats.earlyArrivals} total</p>
                  )}
                </div>
                <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Overtime</p>
                  <p className="text-2xl font-bold text-purple-500">{filteredStats.overtime}</p>
                  {filteredStats.totalPresent !== stats.totalPresent && (
                    <p className="text-xs text-muted-foreground">of {stats.overtime} total</p>
                  )}
                </div>
                <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center">
                  <Clock className="w-6 h-6 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Visual Analytics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Attendance Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Attendance Rate
              </CardTitle>
              <CardDescription>
                Present vs Absent for {format(new Date(selectedDate), "MMM dd, yyyy")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative h-[300px] flex items-center justify-center">
                <div className="absolute inset-0">
                  <ChartContainer
                    config={{
                      attended: {
                        label: "Attended",
                        color: "hsl(142, 76%, 36%)",
                      },
                      absent: {
                        label: "Absent",
                        color: "hsl(0, 84%, 60%)",
                      },
                    }}
                    className="h-full w-full"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Present", value: stats.totalPresent, fill: "hsl(142, 76%, 36%)" },
                            { name: "Absent", value: stats.absent, fill: "hsl(0, 84%, 60%)" },
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          dataKey="value"
                          startAngle={90}
                          endAngle={-270}
                        >
                          <Cell fill="hsl(142, 76%, 36%)" />
                          <Cell fill="hsl(0, 84%, 60%)" />
                        </Pie>
                        <ChartTooltip content={<ChartTooltipContent />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
                <div className="relative z-10 text-center pointer-events-none">
                  <p className="text-4xl font-bold text-green-500">
                    {stats.totalMembers > 0 
                      ? Math.round((stats.totalPresent / stats.totalMembers) * 100)
                      : 0}%
                  </p>
                  <p className="text-sm text-muted-foreground">Present</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Attendance Metrics Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Attendance Metrics
              </CardTitle>
              <CardDescription>
                Comprehensive attendance overview
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  count: {
                    label: "Count",
                    color: "hsl(var(--primary))",
                  },
                }}
                className="h-[300px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      { name: "Early", count: stats.earlyArrivals, fill: "hsl(221, 83%, 53%)" },
                      { name: "On Time", count: stats.onTime, fill: "hsl(142, 76%, 36%)" },
                      { name: "Late", count: stats.late, fill: "hsl(38, 92%, 50%)" },
                      { name: "Absent", count: stats.absent, fill: "hsl(0, 84%, 60%)" },
                      { name: "Overtime", count: stats.overtime, fill: "hsl(280, 100%, 50%)" },
                    ]}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <XAxis dataKey="name" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                      {[
                        { fill: "hsl(221, 83%, 53%)" },
                        { fill: "hsl(142, 76%, 36%)" },
                        { fill: "hsl(38, 92%, 50%)" },
                        { fill: "hsl(0, 84%, 60%)" },
                        { fill: "hsl(280, 100%, 50%)" },
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="date">Select Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div>
                <Label htmlFor="search">Search Employee</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="status">Filter by Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="early">Early</SelectItem>
                    <SelectItem value="on-time">On Time</SelectItem>
                    <SelectItem value="late">Late</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="role">Filter by Role</Label>
                <Select value={filterRole} onValueChange={setFilterRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="employee">Employee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Attendance Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Attendance Records ({filteredRecords.length})
            </CardTitle>
            <CardDescription>
              Showing records for {format(new Date(selectedDate), "MMMM d, yyyy")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredRecords.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No attendance records found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRecords.map((record) => {
                  const status = getArrivalStatus(record.clock_in_at);
                  const hoursWorked = calculateWorkHours(record.clock_in_at, record.clock_out_at);
                  const hasOT = record.clock_out_at && hasOvertime(record.clock_in_at, record.clock_out_at);

                  return (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <Avatar className="w-10 h-10">
                          <AvatarFallback className="text-sm font-semibold">
                            {record.users.email.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-medium">
                            {record.users.full_name || record.users.email}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {record.users.email}
                          </p>
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {record.role || "employee"}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-center w-20">
                          <p className="text-xs text-muted-foreground mb-1">Clock In</p>
                          <p className="text-sm font-mono font-semibold">
                            {format(new Date(record.clock_in_at), "HH:mm:ss")}
                          </p>
                        </div>

                        <div className="text-center w-20">
                          <p className="text-xs text-muted-foreground mb-1">Clock Out</p>
                          <p className="text-sm font-mono font-semibold">
                            {record.clock_out_at 
                              ? format(new Date(record.clock_out_at), "HH:mm:ss")
                              : "—"}
                          </p>
                        </div>

                        <div className="text-center w-20">
                          <p className="text-xs text-muted-foreground mb-1">Hours</p>
                          <p className="text-sm font-semibold">
                            {hoursWorked}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 min-w-[120px]">
                          {getStatusBadge(status)}
                          {hasOT && (
                            <Badge variant="outline" className="bg-warning/10 text-warning border-warning">
                              <Clock className="w-3 h-3 mr-1" />
                              OT
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

