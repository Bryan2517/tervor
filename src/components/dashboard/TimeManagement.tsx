import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/enhanced-card";
import { Button } from "@/components/ui/enhanced-button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { 
  Clock, 
  Play, 
  Pause, 
  Square, 
  Users,
  Target,
  TrendingUp,
  Calendar,
  Timer,
  BarChart3
} from "lucide-react";

type UserRole = "owner" | "admin" | "supervisor" | "employee";

interface TimeEntry {
  id: string;
  task_id: string;
  user_id: string;
  started_at: string;
  stopped_at?: string;
  duration?: number;
  description?: string;
  task?: {
    id: string;
    title: string;
    project?: {
      id: string;
      name: string;
    };
  };
  user?: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
  };
}

interface TimeSummary {
  userId: string;
  userName: string;
  userEmail: string;
  avatar_url?: string;
  totalHours: number;
  todayHours: number;
  thisWeekHours: number;
  averageDailyHours: number;
  activeTasks: number;
  completedTasks: number;
  efficiency: number;
}

interface TimeManagementProps {
  organizationId: string;
  currentUserId: string;
  currentUserRole: UserRole;
}

export function TimeManagement({ organizationId, currentUserId, currentUserRole }: TimeManagementProps) {
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [timeSummaries, setTimeSummaries] = useState<TimeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('week');
  const [activeTimers, setActiveTimers] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  useEffect(() => {
    fetchTimeData();
    
    // Set up real-time subscription for time logs
    const channel = supabase
      .channel('time-logs-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'time_logs'
        },
        () => {
          fetchTimeData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, timeRange]);

  const fetchTimeData = async () => {
    try {
      const startDate = getDateRange(timeRange);
      
      // Get time entries for the organization
      const { data: entries, error: entriesError } = await supabase
        .from('time_logs')
        .select(`
          *,
          task:tasks!inner(
            id,
            title,
            project:projects!inner(organization_id)
          ),
          user:users!inner(id, full_name, email, avatar_url)
        `)
        .eq('task.project.organization_id', organizationId)
        .gte('timestamp', startDate)
        .order('timestamp', { ascending: false });

      if (entriesError) throw entriesError;

      // Get employees for time summaries
      const { data: allMembers } = await supabase
        .from('organization_members')
        .select(`
          user_id,
          role,
          users!inner(id, full_name, email, avatar_url)
        `)
        .eq('organization_id', organizationId);
      
      // Filter employees on client side
      const employees = allMembers?.filter(member => member.role === 'employee') || [];

      if (!employees) return;

      // Calculate time summaries for each employee
      const summaries = await Promise.all(
        employees.map(async (employee: any) => {
          const userEntries = entries?.filter(entry => entry.user_id === employee.user_id) || [];
          
          const totalHours = userEntries.reduce((total, entry) => {
            return total + (entry.duration || 0);
          }, 0) / 3600; // Convert seconds to hours

          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const todayEntries = userEntries.filter(entry => 
            new Date(entry.timestamp) >= today
          );
          const todayHours = todayEntries.reduce((total, entry) => {
            return total + (entry.duration || 0);
          }, 0) / 3600;

          const weekStart = new Date();
          weekStart.setDate(weekStart.getDate() - 7);
          const weekEntries = userEntries.filter(entry => 
            new Date(entry.timestamp) >= weekStart
          );
          const thisWeekHours = weekEntries.reduce((total, entry) => {
            return total + (entry.duration || 0);
          }, 0) / 3600;

          const averageDailyHours = thisWeekHours / 7;

          // Get task counts
          const { data: userTasks } = await supabase
            .from('tasks')
            .select('id, status, project:projects!inner(organization_id)')
            .eq('project.organization_id', organizationId)
            .eq('assignee_id', employee.user_id);

          const activeTasks = userTasks?.filter(t => t.status === 'in_progress').length || 0;
          const completedTasks = userTasks?.filter(t => t.status === 'done').length || 0;

          // Calculate efficiency (completed tasks per hour)
          const efficiency = totalHours > 0 ? (completedTasks / totalHours) * 100 : 0;

          return {
            userId: employee.user_id,
            userName: employee.users.full_name,
            userEmail: employee.users.email,
            avatar_url: employee.users.avatar_url,
            totalHours: Math.round(totalHours * 10) / 10,
            todayHours: Math.round(todayHours * 10) / 10,
            thisWeekHours: Math.round(thisWeekHours * 10) / 10,
            averageDailyHours: Math.round(averageDailyHours * 10) / 10,
            activeTasks,
            completedTasks,
            efficiency: Math.round(efficiency * 10) / 10,
          };
        })
      );

      setTimeEntries(entries || []);
      setTimeSummaries(summaries);
    } catch (error) {
      console.error('Error fetching time data:', error);
      toast({
        title: "Error",
        description: "Failed to load time management data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getDateRange = (range: 'today' | 'week' | 'month') => {
    const now = new Date();
    switch (range) {
      case 'today':
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today.toISOString();
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      default:
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    }
  };

  const startTimer = async (taskId: string) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { error } = await supabase
        .from('time_logs')
        .insert({
          task_id: taskId,
          user_id: user.user.id,
          action: 'start',
          timestamp: new Date().toISOString(),
        });

      if (error) throw error;

      setActiveTimers(prev => ({ ...prev, [taskId]: true }));
      
      toast({
        title: "Timer Started",
        description: "Time tracking has started for this task",
      });
    } catch (error) {
      console.error('Error starting timer:', error);
      toast({
        title: "Error",
        description: "Failed to start timer",
        variant: "destructive",
      });
    }
  };

  const stopTimer = async (taskId: string) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { error } = await supabase
        .from('time_logs')
        .insert({
          task_id: taskId,
          user_id: user.user.id,
          action: 'stop',
          timestamp: new Date().toISOString(),
        });

      if (error) throw error;

      setActiveTimers(prev => ({ ...prev, [taskId]: false }));
      
      toast({
        title: "Timer Stopped",
        description: "Time tracking has stopped for this task",
      });
    } catch (error) {
      console.error('Error stopping timer:', error);
      toast({
        title: "Error",
        description: "Failed to stop timer",
        variant: "destructive",
      });
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 80) return 'text-green-600';
    if (efficiency >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Time Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="w-full h-10 bg-muted rounded"></div>
            <div className="w-full h-8 bg-muted rounded"></div>
            <div className="w-full h-8 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Time Management
            </div>
            <div className="flex gap-2">
              <Button 
                variant={timeRange === 'today' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setTimeRange('today')}
              >
                Today
              </Button>
              <Button 
                variant={timeRange === 'week' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setTimeRange('week')}
              >
                Week
              </Button>
              <Button 
                variant={timeRange === 'month' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setTimeRange('month')}
              >
                Month
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-6">
            {/* Team Time Summary */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Team Time Summary
              </h3>
              <div className="space-y-4">
                {timeSummaries.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No team members found</p>
                  </div>
                ) : (
                  timeSummaries.map((summary) => (
                    <div key={summary.userId} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={summary.avatar_url || undefined} />
                            <AvatarFallback>
                              {summary.userName.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{summary.userName}</div>
                            <div className="text-sm text-muted-foreground">{summary.userEmail}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary">
                            {summary.thisWeekHours}h
                          </div>
                          <div className="text-sm text-muted-foreground">This Week</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Timer className="w-4 h-4 text-blue-500" />
                          <div>
                            <div className="font-medium">{summary.todayHours}h</div>
                            <div className="text-muted-foreground">Today</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-green-500" />
                          <div>
                            <div className="font-medium">{summary.averageDailyHours}h</div>
                            <div className="text-muted-foreground">Daily Avg</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-orange-500" />
                          <div>
                            <div className="font-medium">{summary.activeTasks}</div>
                            <div className="text-muted-foreground">Active Tasks</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-purple-500" />
                          <div>
                            <div className={`font-medium ${getEfficiencyColor(summary.efficiency)}`}>
                              {summary.efficiency}%
                            </div>
                            <div className="text-muted-foreground">Efficiency</div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-3">
                        <div className="flex justify-between text-sm mb-1">
                          <span>Weekly Progress</span>
                          <span>{summary.thisWeekHours}/40h</span>
                        </div>
                        <Progress value={Math.min(100, (summary.thisWeekHours / 40) * 100)} className="h-2" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Time Entries */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Recent Time Entries
              </h3>
              <div className="space-y-3">
                {timeEntries.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No time entries found</p>
                  </div>
                ) : (
                  timeEntries.slice(0, 10).map((entry) => (
                    <div key={entry.id} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={entry.user?.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {entry.user?.full_name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{entry.task?.title}</div>
                            <div className="text-sm text-muted-foreground">
                              {entry.user?.full_name} • {entry.task?.project?.name}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {entry.duration && (
                            <Badge variant="outline">
                              {formatDuration(entry.duration)}
                            </Badge>
                          )}
                          <Badge variant={entry.action === 'start' ? 'default' : 'secondary'}>
                            {entry.action === 'start' ? 'Active' : 'Stopped'}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="mt-2 text-xs text-muted-foreground">
                        {new Date(entry.timestamp).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
