import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/enhanced-card";
import { Button } from "@/components/ui/enhanced-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { OnlinePresence } from "../shared/OnlinePresence";
import { InvitationManager } from "../shared/InvitationManager";
import { Link } from "react-router-dom";
import { 
  Shield, 
  Users, 
  Building2, 
  Target, 
  Settings, 
  Coins,
  TrendingUp,
  Calendar,
  Clock,
  CheckCircle2,
  Gift
} from "lucide-react";

type UserRole = "owner" | "admin" | "supervisor" | "employee";

interface Organization {
  id: string;
  name: string;
  logo_url?: string;
  role: UserRole;
}

interface AdminDashboardProps {
  organization: Organization;
  onLogout: () => void;
}

interface AdminStats {
  teamMembers: number;
  managedProjects: number;
  activeTasks: number;
  teamProductivity: number;
  totalPoints: number;
}

export function AdminDashboard({ organization, onLogout }: AdminDashboardProps) {
  const [stats, setStats] = useState<AdminStats>({
    teamMembers: 0,
    managedProjects: 0,
    activeTasks: 0,
    teamProductivity: 0,
    totalPoints: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAdminStats();
  }, [organization.id]);

  const fetchAdminStats = async () => {
    try {
      // Fetch admin-specific statistics
      const [membersData, projectsData, tasksData, completedTasksData] = await Promise.all([
        supabase
          .from('organization_members')
          .select('user_id')
          .eq('organization_id', organization.id)
          .neq('role', 'owner'),
        supabase
          .from('projects')
          .select('id')
          .eq('organization_id', organization.id),
        supabase
          .from('tasks')
          .select('status, project:projects!inner(organization_id)')
          .eq('project.organization_id', organization.id)
          .neq('status', 'done'),
        supabase
          .from('tasks')
          .select('status, priority, project:projects!inner(organization_id)')
          .eq('project.organization_id', organization.id)
          .eq('status', 'done')
      ]);

      const teamMembers = membersData.data?.length || 0;
      const managedProjects = projectsData.data?.length || 0;
      const activeTasks = tasksData.data?.length || 0;
      
      // Calculate total points and productivity
      const completedTasks = completedTasksData.data || [];
      const totalPoints = completedTasks.reduce((sum, task) => {
        const points = task.priority === 'high' ? 3 : task.priority === 'medium' ? 2 : 1;
        return sum + points;
      }, 0);
      
      const totalTasks = activeTasks + completedTasks.length;
      const teamProductivity = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;

      setStats({
        teamMembers,
        managedProjects,
        activeTasks,
        teamProductivity,
        totalPoints,
      });
    } catch (error) {
      console.error('Error fetching admin stats:', error);
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
                  <Shield className="w-4 h-4 text-purple-500" />
                  <p className="text-sm text-muted-foreground">Admin Dashboard</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <Link to="/admin/settings">
                <Button variant="outline">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
              </Link>
              <Button variant="ghost" onClick={onLogout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Admin Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Link to="/admin/manage-team">
            <Card variant="interactive" className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Team Members</p>
                    <p className="text-2xl font-bold">{stats.teamMembers}</p>
                  </div>
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/admin/progress-tracking">
            <Card variant="interactive" className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Managed Projects</p>
                    <p className="text-2xl font-bold">{stats.managedProjects}</p>
                  </div>
                  <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-accent" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/admin/task-assignment">
            <Card variant="interactive" className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Active Tasks</p>
                    <p className="text-2xl font-bold">{stats.activeTasks}</p>
                  </div>
                  <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center">
                    <Target className="w-6 h-6 text-warning" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Card variant="interactive">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Team Productivity</p>
                  <div className="flex items-center gap-3">
                    <p className="text-2xl font-bold">{stats.teamProductivity}%</p>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Coins className="w-4 h-4" />
                      <span>{stats.totalPoints}</span>
                    </div>
                  </div>
                </div>
                <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Management Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Management Tools
                </CardTitle>
                <CardDescription>
                  Administrative functions and team management
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <Link to="/admin/manage-team">
                    <Button variant="outline" className="h-20 flex-col gap-2 w-full">
                      <Users className="w-6 h-6" />
                      <span>Manage Team</span>
                    </Button>
                  </Link>
                  <Link to="/admin/task-assignment">
                    <Button variant="outline" className="h-20 flex-col gap-2 w-full">
                      <Target className="w-6 h-6" />
                      <span>Task Assignment</span>
                    </Button>
                  </Link>
                  <Link to="/admin/time-management">
                    <Button variant="outline" className="h-20 flex-col gap-2 w-full">
                      <Clock className="w-6 h-6" />
                      <span>Time Management</span>
                    </Button>
                  </Link>
                  <Link to="/admin/quality-review">
                    <Button variant="outline" className="h-20 flex-col gap-2 w-full">
                      <CheckCircle2 className="w-6 h-6" />
                      <span>Quality Review</span>
                    </Button>
                  </Link>
                  <Link to="/admin/shop">
                    <Button variant="outline" className="h-20 flex-col gap-2 w-full">
                      <Gift className="w-6 h-6" />
                      <span>Rewards Shop</span>
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Team Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Team Performance Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm font-medium">Task Completion Rate</span>
                    <span className="text-sm font-bold text-success">{stats.teamProductivity}%</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm font-medium">Average Response Time</span>
                    <span className="text-sm font-bold">2.3 hours</span>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm font-medium">Team Satisfaction</span>
                    <span className="text-sm font-bold text-success">87%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Admin Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Recent Administrative Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                    <div>
                      <p className="text-sm font-medium">Role updated for Alice Smith (Employee → Supervisor)</p>
                      <p className="text-xs text-muted-foreground">30 minutes ago</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-2 h-2 bg-success rounded-full mt-2"></div>
                    <div>
                      <p className="text-sm font-medium">New team member Mike Johnson added to Design Team</p>
                      <p className="text-xs text-muted-foreground">2 hours ago</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-2 h-2 bg-warning rounded-full mt-2"></div>
                    <div>
                      <p className="text-sm font-medium">Project "Q4 Campaign" deadline extended</p>
                      <p className="text-xs text-muted-foreground">1 day ago</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <OnlinePresence organizationId={organization.id} />
            <InvitationManager organizationId={organization.id} userRole="admin" />
          </div>
        </div>
      </div>
    </div>
  );
}