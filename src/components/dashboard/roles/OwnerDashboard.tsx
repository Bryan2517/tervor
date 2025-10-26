import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/enhanced-card";
import { Button } from "@/components/ui/enhanced-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { OnlinePresence } from "../shared/OnlinePresence";
import { InvitationManager } from "../shared/InvitationManager";
import { ClockOutButton } from "../shared/ClockOutButton";
import { 
  Crown, 
  Building2, 
  Users, 
  TrendingUp, 
  Settings, 
  Coins,
  Target,
  Calendar,
  BarChart3,
  Gift,
  LogOut,
  Wrench,
  UsersRound,
  Clock
} from "lucide-react";

type UserRole = "owner" | "admin" | "supervisor" | "employee";

interface Organization {
  id: string;
  name: string;
  logo_url?: string;
  role: UserRole;
}

interface OwnerDashboardProps {
  organization: Organization;
  onLogout: () => void;
  onClockOut: () => void;
}

interface OrgStats {
  totalMembers: number;
  activeProjects: number;
  totalTasks: number;
  completionRate: number;
}

export function OwnerDashboard({ organization, onLogout, onClockOut }: OwnerDashboardProps) {
  const [stats, setStats] = useState<OrgStats>({
    totalMembers: 0,
    activeProjects: 0,
    totalTasks: 0,
    completionRate: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrgStats();
  }, [organization.id]);

  const fetchOrgStats = async () => {
    try {
      // Fetch organization statistics
      const [membersData, projectsData, tasksData] = await Promise.all([
        supabase
          .from('organization_members')
          .select('user_id')
          .eq('organization_id', organization.id),
        supabase
          .from('projects')
          .select('id')
          .eq('organization_id', organization.id),
        supabase
          .from('tasks')
          .select('status, project:projects!inner(organization_id)')
          .eq('project.organization_id', organization.id)
      ]);

      const totalMembers = membersData.data?.length || 0;
      const activeProjects = projectsData.data?.length || 0;
      const totalTasks = tasksData.data?.length || 0;
      const completedTasks = tasksData.data?.filter(task => task.status === 'done').length || 0;
      const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      setStats({
        totalMembers,
        activeProjects,
        totalTasks,
        completionRate,
      });
    } catch (error) {
      console.error('Error fetching organization stats:', error);
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
                  <Crown className="w-4 h-4 text-yellow-500" />
                  <p className="text-sm text-muted-foreground">Owner Dashboard</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <Button variant="outline" asChild>
                <Link to="/owner/organization-settings">
                  <Settings className="w-4 h-4 mr-2" />
                  Organization Settings
                </Link>
              </Button>
              <ClockOutButton 
                organizationId={organization.id}
                organizationName={organization.name}
                onClockOut={onClockOut}
              />
              <Button variant="ghost" onClick={onLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Organization Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Link to="/owner/team">
          <Card variant="interactive">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Members</p>
                  <p className="text-2xl font-bold">{stats.totalMembers}</p>
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/owner/projects">
          <Card variant="interactive">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Projects</p>
                  <p className="text-2xl font-bold">{stats.activeProjects}</p>
                </div>
                <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/owner/tasks">
          <Card variant="interactive">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Tasks</p>
                  <p className="text-2xl font-bold">{stats.totalTasks}</p>
                </div>
                <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center">
                  <Target className="w-6 h-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link to="/owner/analytics">
          <Card variant="interactive">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Completion Rate</p>
                  <p className="text-2xl font-bold">{stats.completionRate}%</p>
                </div>
                <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="w-5 h-5" />
                  Quick Actions
                </CardTitle>
                <CardDescription>
                  Manage your organization
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <Button variant="outline" className="h-20 flex-col gap-2" asChild>
                    <Link to="/owner/projects/new">
                      <Building2 className="w-6 h-6" />
                      <span>Create Project</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col gap-2" asChild>
                    <Link to="/owner/tasks/new">
                      <Target className="w-6 h-6" />
                      <span>Create Task</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col gap-2" asChild>
                    <Link to="/owner/assignments/new">
                      <Users className="w-6 h-6" />
                      <span>Create Assignment</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col gap-2" asChild>
                    <Link to="/owner/analytics">
                      <BarChart3 className="w-6 h-6" />
                      <span>Analytics</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col gap-2" asChild>
                    <Link to="/owner/teams">
                      <UsersRound className="w-6 h-6" />
                      <span>Team Management</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col gap-2" asChild>
                    <Link to="/owner/time-logging">
                      <Clock className="w-6 h-6" />
                      <span>Time Logging</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col gap-2" asChild>
                    <Link to="/owner/shop/manage">
                      <Gift className="w-6 h-6" />
                      <span>Shop Management</span>
                    </Link>
                  </Button>
                  <Button variant="outline" className="h-20 flex-col gap-2" asChild>
                    <Link to="/owner/settings">
                      <Settings className="w-6 h-6" />
                      <span>Settings</span>
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Recent Organization Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-2 h-2 bg-success rounded-full mt-2"></div>
                    <div>
                      <p className="text-sm font-medium">New project "Mobile App Redesign" created</p>
                      <p className="text-xs text-muted-foreground">2 hours ago</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2"></div>
                    <div>
                      <p className="text-sm font-medium">John Doe joined the organization</p>
                      <p className="text-xs text-muted-foreground">1 day ago</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-2 h-2 bg-warning rounded-full mt-2"></div>
                    <div>
                      <p className="text-sm font-medium">Task deadline approaching for "API Integration"</p>
                      <p className="text-xs text-muted-foreground">3 days ago</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <OnlinePresence organizationId={organization.id} />
            <InvitationManager organizationId={organization.id} userRole="owner" />
          </div>
        </div>
      </div>
    </div>
  );
}