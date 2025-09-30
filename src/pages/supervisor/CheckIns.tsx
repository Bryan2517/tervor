import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/enhanced-card";
import { Button } from "@/components/ui/enhanced-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Calendar,
  Clock,
  Download,
  Search,
  Users,
  AlertCircle,
  CheckCircle2,
  RefreshCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { 
  getCheckInsForDate, 
  subscribeToCheckIns, 
  exportCheckInsToCSV, 
  downloadCSV,
  CheckInWithUser 
} from "@/lib/attendance";
import { todayInMY, getTimeInMY, getRelativeTime, isAfterThreshold } from "@/lib/tz";

interface CheckInsPageProps {
  organizationId: string;
  organizationName: string;
}

export function CheckInsPage({ organizationId, organizationName }: CheckInsPageProps) {
  const [checkIns, setCheckIns] = useState<CheckInWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayInMY());
  const [refreshing, setRefreshing] = useState(false);
  const { toast } = useToast();

  // Load check-ins for selected date
  const loadCheckIns = async (date: string) => {
    setLoading(true);
    try {
      // First get check-ins
      const { data: checkInsData, error: checkInsError } = await getCheckInsForDate(organizationId, date);
      
      if (checkInsError) {
        throw checkInsError;
      }
      
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
      
      if (usersError) {
        throw usersError;
      }
      
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

  // Handle real-time updates
  const handleRealtimeUpdate = (payload: any) => {
    if (payload.new && payload.new.local_date === selectedDate) {
      // Add new check-in to the list
      setCheckIns(prev => {
        const exists = prev.some(checkIn => checkIn.id === payload.new.id);
        if (!exists) {
          return [...prev, payload.new].sort((a, b) => 
            new Date(a.clock_in_at).getTime() - new Date(b.clock_in_at).getTime()
          );
        }
        return prev;
      });
    }
  };

  // Subscribe to real-time updates
  useEffect(() => {
    if (!organizationId || !selectedDate) return;

    const channel = subscribeToCheckIns(
      organizationId,
      selectedDate,
      handleRealtimeUpdate,
      undefined,
      undefined
    );

    return () => {
      channel.unsubscribe();
    };
  }, [organizationId, selectedDate]);

  // Load initial data
  useEffect(() => {
    loadCheckIns(selectedDate);
  }, [selectedDate, organizationId]);

  // Filter check-ins based on search term
  const filteredCheckIns = checkIns.filter(checkIn =>
    checkIn.user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    checkIn.user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle date change
  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setSearchTerm(""); // Clear search when changing date
  };

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadCheckIns(selectedDate);
    setRefreshing(false);
  };

  // Handle CSV export
  const handleExportCSV = () => {
    const csvContent = exportCheckInsToCSV(filteredCheckIns);
    const filename = `check-ins-${selectedDate}-${organizationName.replace(/\s+/g, '-')}.csv`;
    downloadCSV(csvContent, filename);
    
    toast({
      title: "Export Successful",
      description: `Exported ${filteredCheckIns.length} check-ins to CSV`,
    });
  };

  // Get statistics
  const totalCheckIns = filteredCheckIns.length;
  const lateCheckIns = filteredCheckIns.filter(checkIn => 
    isAfterThreshold(checkIn.clock_in_at, 9, 15)
  ).length;
  const onTimeCheckIns = totalCheckIns - lateCheckIns;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Daily Check-ins</h1>
          <p className="text-muted-foreground">
            Monitor team attendance for {organizationName}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={handleExportCSV}
            disabled={filteredCheckIns.length === 0}
            size="sm"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date-filter">Date</Label>
              <Input
                id="date-filter"
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="search-filter">Search Members</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  id="search-filter"
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{totalCheckIns}</p>
                <p className="text-sm text-muted-foreground">Total Check-ins</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{onTimeCheckIns}</p>
                <p className="text-sm text-muted-foreground">On Time</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">{lateCheckIns}</p>
                <p className="text-sm text-muted-foreground">Late Arrivals</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Check-ins Table */}
      <Card>
        <CardHeader>
          <CardTitle>Check-ins for {selectedDate}</CardTitle>
          <CardDescription>
            {filteredCheckIns.length} of {checkIns.length} check-ins
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredCheckIns.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No check-ins found</h3>
              <p className="text-muted-foreground">
                {searchTerm ? "Try adjusting your search terms" : "No one has checked in for this date"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Clock-in Time</TableHead>
                    <TableHead>Relative Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Source</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCheckIns.map((checkIn) => {
                    const isLate = isAfterThreshold(checkIn.clock_in_at, 9, 15);
                    const clockInTime = getTimeInMY(checkIn.clock_in_at);
                    const relativeTime = getRelativeTime(checkIn.clock_in_at);
                    
                    return (
                      <TableRow key={checkIn.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="w-8 h-8">
                              <AvatarImage src={checkIn.user.avatar_url} />
                              <AvatarFallback>
                                {checkIn.user.full_name.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{checkIn.user.full_name}</p>
                              <p className="text-sm text-muted-foreground">{checkIn.user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-muted-foreground" />
                            <span className="font-mono">{clockInTime}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">{relativeTime}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant={isLate ? "destructive" : "default"}>
                            {isLate ? "Late" : "On Time"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{checkIn.source}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
