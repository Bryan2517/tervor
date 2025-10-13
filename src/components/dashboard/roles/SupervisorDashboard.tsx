import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/enhanced-card";
import { Button } from "@/components/ui/enhanced-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { OnlinePresence } from "../shared/OnlinePresence";
import { InvitationManager } from "../shared/InvitationManager";
import { 
  Eye, 
  Users, 
  Target, 
  Clock, 
  CheckCircle2, 
  TrendingUp,
  Calendar,
  UserPlus,
  AlertTriangle,
  Gift,
  Coins,
  LogOut
} from "lucide-react";

type UserRole = "owner" | "admin" | "supervisor" | "employee";

interface Organization {
  id: string;
  name: string;
  logo_url?: string;
  role: UserRole;
}

interface SupervisorDashboardProps {
  organization: Organization;
  onLogout: () => void;
}

interface SupervisorStats {
  directReports: number;
  tasksOverseeing: number;
  completedToday: number;
  teamEfficiency: number;
  totalPoints: number;
}

export function SupervisorDashboard({ organization, onLogout }: SupervisorDashboardProps) {
  const [stats, setStats] = useState<SupervisorStats>({
    directReports: 0,
    tasksOverseeing: 0,
    completedToday: 0,
    teamEfficiency: 0,
    totalPoints: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSupervisorStats();
  }, [organization.id]);

  const fetchSupervisorStats = async () => {
    try {
      // Fetch supervisor-specific statistics
      const [employeesData, tasksData, completedTasksData] = await Promise.all([
        supabase
          .from('organization_members')
          .select('id')
          .eq('organization_id', organization.id)
          .eq('role', 'employee'),
        supabase
          .from('tasks')
          .select('status, created_at, project:projects!inner(organization_id)')
          .eq('project.organization_id', organization.id),
        supabase
          .from('tasks')
          .select('status, priority, project:projects!inner(organization_id)')
          .eq('project.organization_id', organization.id)
          .eq('status', 'done')
      ]);

      const directReports = employeesData.data?.length || 0;
      const tasksOverseeing = tasksData.data?.length || 0;
      
      // Calculate tasks completed today
      const today = new Date().toDateString();
      const completedToday = tasksData.data?.filter(task => 
        task.status === 'done' && 
        new Date(task.created_at).toDateString() === today
      ).length || 0;

      // Calculate total points
      const completedTasks = completedTasksData.data || [];
      const totalPoints = completedTasks.reduce((sum, task) => {
        const points = task.priority === 'high' ? 3 : task.priority === 'medium' ? 2 : 1;
        return sum + points;
      }, 0);

      // Calculate efficiency
      const totalTasks = tasksData.data?.length || 0;
      const teamEfficiency = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;

      setStats({
        directReports,
        tasksOverseeing,
        completedToday,
        teamEfficiency,
        totalPoints,
      });
    } catch (error) {
      console.error('Error fetching supervisor stats:', error);
    } finally {
      setLoading(false);
    }
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
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="w-10 h-10">
                <AvatarImage src={organization.logo_url || undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {organization.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-xl font-semibold">{organization.name}</h1>
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-blue-500" />
                  <p className="text-sm text-muted-foreground">Supervisor Dashboard</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <Link to="/supervisor/manage-team">
                <Button variant="outline">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Manage Team
                </Button>
              </Link>
              <Button variant="ghost" onClick={onLogout}><LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Supervisor Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Link to="/supervisor/direct-reports" className="group">
          <Card variant="interactive">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Direct Reports</p>
                  <p className="text-2xl font-bold">{stats.directReports}</p>
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          </Link>

          <Link to="/supervisor/task-overseeing" className="group">
          <Card variant="interactive">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Tasks Overseeing</p>
                  <p className="text-2xl font-bold">{stats.tasksOverseeing}</p>
                </div>
                <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center">
                  <Target className="w-6 h-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
          </Link>

          <Link to="/supervisor/complete-today" className="group">
          <Card variant="interactive">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Completed Today</p>
                  <p className="text-2xl font-bold">{stats.completedToday}</p>
                </div>
                <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
          </Link>

          <Card variant="interactive">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Team Efficiency</p>
                  <div className="flex items-center gap-3">
                    <p className="text-2xl font-bold">{stats.teamEfficiency}%</p>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Coins className="w-4 h-4" />
                      <span>{stats.totalPoints}</span>
                    </div>
                  </div>
                </div>
                <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Supervision Tools */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  Supervision Tools
                </CardTitle>
                <CardDescription>
                  Manage and oversee your team's work
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <Button variant="outline" className="h-20 flex-col gap-2" asChild>
                    <Link to="/supervisor/task-assignment">
                      <Target className="w-6 h-6" />
                      <span>Task Assignment</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col gap-2" asChild>
                    <Link to="/supervisor/progress-tracking">
                      <TrendingUp className="w-6 h-6" />
                      <span>Progress Tracking</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col gap-2" asChild>
                    <Link to="/supervisor/time-management">
                      <Clock className="w-6 h-6" />
                      <span>Time Management</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col gap-2" asChild>
                    <Link to="/supervisor/quality-review">
                      <CheckCircle2 className="w-6 h-6" />
                      <span>Quality Review</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col gap-2" asChild>
                    <Link to="/supervisor/shop">
                      <Gift className="w-6 h-6" />
                      <span>Rewards Shop</span>
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Team Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Team Performance Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm font-medium">Average Task Completion</span>
                    <span className="text-sm font-bold text-success">4.2 tasks/day</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm font-medium">Quality Score</span>
                    <span className="text-sm font-bold text-success">92%</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm font-medium">On-time Delivery</span>
                    <span className="text-sm font-bold">{stats.teamEfficiency}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Team Alerts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Team Alerts & Attention Required
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-warning/10 rounded-lg border-l-4 border-l-warning">
                    <AlertTriangle className="w-4 h-4 text-warning mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Task overdue: "Database Optimization"</p>
                      <p className="text-xs text-muted-foreground">Assigned to John Doe • Due 2 days ago</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-3 bg-primary/10 rounded-lg border-l-4 border-l-primary">
                    <Clock className="w-4 h-4 text-primary mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Employee requested deadline extension</p>
                      <p className="text-xs text-muted-foreground">Alice Smith • "API Documentation" task</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-3 bg-success/10 rounded-lg border-l-4 border-l-success">
                    <CheckCircle2 className="w-4 h-4 text-success mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Team exceeded this week's goals</p>
                      <p className="text-xs text-muted-foreground">15 tasks completed vs 12 target</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <OnlinePresence organizationId={organization.id} />
            <InvitationManager organizationId={organization.id} userRole="supervisor" />
          </div>
        </div>
      </div>
    </div>
  );
}