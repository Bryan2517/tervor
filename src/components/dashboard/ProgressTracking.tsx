import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/enhanced-card";
import { Button } from "@/components/ui/enhanced-button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { 
  TrendingUp, 
  Target, 
  Clock, 
  CheckCircle2,
  AlertTriangle,
  Users,
  Calendar,
  BarChart3
} from "lucide-react";

type UserRole = "owner" | "admin" | "supervisor" | "employee";

interface ProgressMetrics {
  userId: string;
  userName: string;
  userEmail: string;
  avatar_url?: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  completionRate: number;
  averageCompletionTime: number;
  currentStreak: number;
  qualityScore: number;
}

interface ProjectProgress {
  projectId: string;
  projectName: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  completionRate: number;
  health: 'Good' | 'At Risk' | 'Blocked';
}

interface ProgressTrackingProps {
  organizationId: string;
  currentUserId: string;
  currentUserRole: UserRole;
}

export function ProgressTracking({ organizationId, currentUserId, currentUserRole }: ProgressTrackingProps) {
  const [employeeMetrics, setEmployeeMetrics] = useState<ProgressMetrics[]>([]);
  const [projectProgress, setProjectProgress] = useState<ProjectProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter'>('month');
  const { toast } = useToast();

  useEffect(() => {
    fetchProgressData();
  }, [organizationId, timeRange]);

  const fetchProgressData = async () => {
    try {
      const startDate = getDateRange(timeRange);
      
      // Get all employees in the organization
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

      // Get all projects in the organization
      const { data: projects } = await supabase
        .from('projects')
        .select('id, name')
        .eq('organization_id', organizationId);

      if (!projects) return;

      // Calculate employee metrics
      const employeeMetricsData = await Promise.all(
        employees.map(async (employee: any) => {
          const { data: tasks } = await supabase
            .from('tasks')
            .select('id, status, created_at, updated_at, due_date, project:projects!inner(organization_id)')
            .eq('project.organization_id', organizationId)
            .eq('assignee_id', employee.user_id)
            .gte('created_at', startDate);

          const totalTasks = tasks?.length || 0;
          const completedTasks = tasks?.filter(t => t.status === 'done').length || 0;
          const inProgressTasks = tasks?.filter(t => t.status === 'in_progress').length || 0;
          const overdueTasks = tasks?.filter(t => {
            if (!t.due_date || t.status === 'done') return false;
            return new Date(t.due_date) < new Date();
          }).length || 0;

          const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

          // Calculate average completion time
          const completedTasksWithTimes = tasks?.filter(t => 
            t.status === 'done' && t.created_at && t.updated_at
          ) || [];
          
          const totalCompletionTime = completedTasksWithTimes.reduce((total, task) => {
            const created = new Date(task.created_at);
            const completed = new Date(task.updated_at);
            return total + (completed.getTime() - created.getTime());
          }, 0);
          
          const averageCompletionTime = completedTasksWithTimes.length > 0 
            ? totalCompletionTime / completedTasksWithTimes.length / (1000 * 60 * 60 * 24) // Convert to days
            : 0;

          // Calculate current streak (consecutive days with completed tasks)
          const currentStreak = await calculateCurrentStreak(employee.user_id);

          // Mock quality score (in real app, this would be based on reviews/feedback)
          const qualityScore = Math.min(95, Math.max(70, 85 + Math.random() * 10));

          return {
            userId: employee.user_id,
            userName: employee.users.full_name,
            userEmail: employee.users.email,
            avatar_url: employee.users.avatar_url,
            totalTasks,
            completedTasks,
            inProgressTasks,
            overdueTasks,
            completionRate: Math.round(completionRate * 10) / 10,
            averageCompletionTime: Math.round(averageCompletionTime * 10) / 10,
            currentStreak,
            qualityScore: Math.round(qualityScore),
          };
        })
      );

      // Calculate project progress
      const projectProgressData = await Promise.all(
        projects.map(async (project) => {
          const { data: tasks } = await supabase
            .from('tasks')
            .select('id, status, due_date')
            .eq('project_id', project.id)
            .gte('created_at', startDate);

          const totalTasks = tasks?.length || 0;
          const completedTasks = tasks?.filter(t => t.status === 'done').length || 0;
          const inProgressTasks = tasks?.filter(t => t.status === 'in_progress').length || 0;
          const overdueTasks = tasks?.filter(t => {
            if (!t.due_date || t.status === 'done') return false;
            return new Date(t.due_date) < new Date();
          }).length || 0;

          const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

          let health: 'Good' | 'At Risk' | 'Blocked' = 'Good';
          if (overdueTasks > 0) {
            health = 'Blocked';
          } else if (completionRate < 50 || inProgressTasks > totalTasks * 0.8) {
            health = 'At Risk';
          }

          return {
            projectId: project.id,
            projectName: project.name,
            totalTasks,
            completedTasks,
            inProgressTasks,
            overdueTasks,
            completionRate: Math.round(completionRate * 10) / 10,
            health,
          };
        })
      );

      setEmployeeMetrics(employeeMetricsData);
      setProjectProgress(projectProgressData);
    } catch (error) {
      console.error('Error fetching progress data:', error);
      toast({
        title: "Error",
        description: "Failed to load progress data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getDateRange = (range: 'week' | 'month' | 'quarter') => {
    const now = new Date();
    switch (range) {
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      case 'quarter':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      default:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }
  };

  const calculateCurrentStreak = async (userId: string) => {
    // This is a simplified calculation - in a real app, you'd track daily completions
    const { data: recentTasks } = await supabase
      .from('tasks')
      .select('updated_at')
      .eq('assignee_id', userId)
      .eq('status', 'done')
      .gte('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('updated_at', { ascending: false });

    // Simple streak calculation based on recent completions
    return Math.min(7, recentTasks?.length || 0);
  };

  const getHealthColor = (health: 'Good' | 'At Risk' | 'Blocked') => {
    switch (health) {
      case 'Good': return 'text-green-600';
      case 'At Risk': return 'text-yellow-600';
      case 'Blocked': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getHealthIcon = (health: 'Good' | 'At Risk' | 'Blocked') => {
    switch (health) {
      case 'Good': return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'At Risk': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'Blocked': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default: return <Target className="w-4 h-4 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Progress Tracking
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
              <TrendingUp className="w-5 h-5" />
              Progress Tracking
            </div>
            <div className="flex gap-2">
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
              <Button 
                variant={timeRange === 'quarter' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setTimeRange('quarter')}
              >
                Quarter
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-6">
            {/* Employee Performance */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Team Performance
              </h3>
              <div className="space-y-4">
                {employeeMetrics.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No team members found</p>
                  </div>
                ) : (
                  employeeMetrics.map((employee) => (
                    <div key={employee.userId} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={employee.avatar_url || undefined} />
                            <AvatarFallback>
                              {employee.userName.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{employee.userName}</div>
                            <div className="text-sm text-muted-foreground">{employee.userEmail}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary">
                            {employee.completionRate}%
                          </div>
                          <div className="text-sm text-muted-foreground">Completion Rate</div>
                        </div>
                      </div>
                      
                      <div className="mb-3">
                        <div className="flex justify-between text-sm mb-1">
                          <span>Progress</span>
                          <span>{employee.completedTasks}/{employee.totalTasks} tasks</span>
                        </div>
                        <Progress value={employee.completionRate} className="h-2" />
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-blue-500" />
                          <div>
                            <div className="font-medium">{employee.totalTasks}</div>
                            <div className="text-muted-foreground">Total Tasks</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          <div>
                            <div className="font-medium">{employee.completedTasks}</div>
                            <div className="text-muted-foreground">Completed</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-orange-500" />
                          <div>
                            <div className="font-medium">{employee.averageCompletionTime}d</div>
                            <div className="text-muted-foreground">Avg Time</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <BarChart3 className="w-4 h-4 text-purple-500" />
                          <div>
                            <div className="font-medium">{employee.qualityScore}%</div>
                            <div className="text-muted-foreground">Quality</div>
                          </div>
                        </div>
                      </div>
                      
                      {employee.overdueTasks > 0 && (
                        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-center gap-2 text-red-700">
                            <AlertTriangle className="w-4 h-4" />
                            <span className="text-sm font-medium">
                              {employee.overdueTasks} overdue task{employee.overdueTasks > 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Project Progress */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Target className="w-5 h-5" />
                Project Progress
              </h3>
              <div className="space-y-4">
                {projectProgress.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No projects found</p>
                  </div>
                ) : (
                  projectProgress.map((project) => (
                    <div key={project.projectId} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            {getHealthIcon(project.health)}
                            <h4 className="font-medium">{project.projectName}</h4>
                          </div>
                          <Badge className={getHealthColor(project.health)}>
                            {project.health}
                          </Badge>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary">
                            {project.completionRate}%
                          </div>
                          <div className="text-sm text-muted-foreground">Complete</div>
                        </div>
                      </div>
                      
                      <div className="mb-3">
                        <div className="flex justify-between text-sm mb-1">
                          <span>Progress</span>
                          <span>{project.completedTasks}/{project.totalTasks} tasks</span>
                        </div>
                        <Progress value={project.completionRate} className="h-2" />
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Target className="w-4 h-4 text-blue-500" />
                          <div>
                            <div className="font-medium">{project.totalTasks}</div>
                            <div className="text-muted-foreground">Total</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          <div>
                            <div className="font-medium">{project.completedTasks}</div>
                            <div className="text-muted-foreground">Completed</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-yellow-500" />
                          <div>
                            <div className="font-medium">{project.inProgressTasks}</div>
                            <div className="text-muted-foreground">In Progress</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                          <div>
                            <div className="font-medium">{project.overdueTasks}</div>
                            <div className="text-muted-foreground">Overdue</div>
                          </div>
                        </div>
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
