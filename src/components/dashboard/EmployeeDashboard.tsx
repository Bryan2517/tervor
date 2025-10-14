import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/enhanced-card";
import { Button } from "@/components/ui/enhanced-button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { 
  Calendar, 
  Clock, 
  Target, 
  Users, 
  Trophy, 
  Coins, 
  Play, 
  Pause, 
  CheckCircle2,
  AlertTriangle,
  Flag,
  MessageSquare,
  Paperclip,
  ArrowRight,
  Star,
  Zap,
  LogOut
} from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { format } from "date-fns";

type UserRole = "owner" | "admin" | "supervisor" | "employee";
type TaskStatus = "todo" | "in_progress" | "blocked" | "done";
type TaskPriority = "low" | "medium" | "high" | "urgent";

interface OrganizationWithRole {
  id: string;
  name: string;
  logo_url?: string;
  role: UserRole;
}

interface Task extends Tables<"tasks"> {
  project: {
    name: string;
    organization_id: string;
  };
  phase?: {
    name: string;
  };
}

interface EmployeeDashboardProps {
  organization: OrganizationWithRole;
  onLogout: () => void;
  onClockOut: () => void;
}

const statusColors = {
  todo: "bg-muted",
  in_progress: "bg-primary",
  blocked: "bg-destructive",
  done: "bg-success",
};

const priorityColors = {
  low: "border-l-priority-low",
  medium: "border-l-priority-medium", 
  high: "border-l-priority-high",
  urgent: "border-l-priority-urgent",
};

export function EmployeeDashboard({ organization, onLogout, onClockOut }: EmployeeDashboardProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState({
    ongoing: 0,
    dueToday: 0,
    overdue: 0,
    completed: 0,
    points: 850,
    rank: 3,
    streak: 5,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserTasks();
    fetchUserStats();
  }, [organization.id]);

  const fetchUserTasks = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          project:projects!inner(name, organization_id),
          phase:phases(name)
        `)
        .eq("assignee_id", user.user?.id)
        .eq("project.organization_id", organization.id)
        .neq("status", "done")
        .order("priority", { ascending: false })
        .order("due_date", { ascending: true });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    }
  };

  const fetchUserStats = async () => {
    try {
      // This would typically fetch from your points_ledger and other tables
      // For now, using mock data
      const ongoing = tasks.filter(t => t.status === "in_progress").length;
      const dueToday = tasks.filter(t => {
        if (!t.due_date) return false;
        const today = new Date().toDateString();
        return new Date(t.due_date).toDateString() === today;
      }).length;
      const overdue = tasks.filter(t => {
        if (!t.due_date) return false;
        return new Date(t.due_date) < new Date() && t.status !== "done";
      }).length;

      setStats(prev => ({
        ...prev,
        ongoing,
        dueToday,
        overdue,
      }));
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskAction = async (taskId: string, action: "start" | "pause" | "complete") => {
    try {
      let newStatus: TaskStatus;
      switch (action) {
        case "start":
          newStatus = "in_progress";
          break;
        case "pause":
          newStatus = "todo";
          break;
        case "complete":
          newStatus = "done";
          break;
      }

      const { error } = await supabase
        .from("tasks")
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq("id", taskId);

      if (error) throw error;

      // Also create time log entry
      if (action === "start" || action === "pause" || action === "complete") {
        await supabase
          .from("time_logs")
          .insert({
            task_id: taskId,
            user_id: (await supabase.auth.getUser()).data.user?.id,
            action: action === "complete" ? "complete" : action,
          });
      }

      await fetchUserTasks();
      await fetchUserStats();
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const getActionButton = (task: Task) => {
    switch (task.status) {
      case "todo":
        return (
          <Button
            variant="start"
            size="sm"
            onClick={() => handleTaskAction(task.id, "start")}
          >
            <Play className="w-3 h-3" />
            Start
          </Button>
        );
      case "in_progress":
        return (
          <div className="flex gap-2">
            <Button
              variant="pause"
              size="sm"
              onClick={() => handleTaskAction(task.id, "pause")}
            >
              <Pause className="w-3 h-3" />
              Pause
            </Button>
            <Button
              variant="complete"
              size="sm"
              onClick={() => handleTaskAction(task.id, "complete")}
            >
              <CheckCircle2 className="w-3 h-3" />
              Complete
            </Button>
          </div>
        );
      case "blocked":
        return (
          <Badge variant="destructive">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Blocked
          </Badge>
        );
      default:
        return null;
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
                <p className="text-sm text-muted-foreground">Employee Dashboard</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <Card variant="points" padding="sm" className="flex items-center gap-2">
                <Coins className="w-5 h-5" />
                <span className="font-semibold">{stats.points}</span>
              </Card>
              <Button variant="outline" asChild>
                <Link to="/employee/shop">Shop</Link>
              </Button>
              <Button variant="default" onClick={onClockOut}>
                Clock Out
              </Button>
              <Button variant="ghost" onClick={onLogout}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card variant="interactive">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Tasks in Progress</p>
                  <p className="text-2xl font-bold">{stats.ongoing}</p>
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Target className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="interactive">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Due Today</p>
                  <p className="text-2xl font-bold">{stats.dueToday}</p>
                </div>
                <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center">
                  <Calendar className="w-6 h-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="interactive">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Streak</p>
                  <p className="text-2xl font-bold">{stats.streak} days</p>
                </div>
                <div className="w-12 h-12 bg-streak/10 rounded-lg flex items-center justify-center">
                  <Zap className="w-6 h-6 text-streak" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card variant="interactive">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Leaderboard Rank</p>
                  <p className="text-2xl font-bold">#{stats.rank}</p>
                </div>
                <div className="w-12 h-12 bg-points/10 rounded-lg flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-points" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* My Tasks */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  My Ongoing Tasks
                </CardTitle>
                <CardDescription>
                  {tasks.length} active task{tasks.length !== 1 ? 's' : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {tasks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No active tasks assigned</p>
                    <p className="text-sm">Great job staying on top of everything!</p>
                  </div>
                ) : (
                  tasks.map((task) => (
                    <Card
                      key={task.id}
                      variant="interactive"
                      className={cn("border-l-4", priorityColors[task.priority])}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-medium">{task.title}</h4>
                              <Badge 
                                variant="outline" 
                                className={cn("text-xs", statusColors[task.status])}
                              >
                                {task.status.replace("_", " ")}
                              </Badge>
                              {task.priority === "urgent" && (
                                <Badge variant="destructive" className="text-xs animate-pulse">
                                  <Flag className="w-3 h-3 mr-1" />
                                  Urgent
                                </Badge>
                              )}
                            </div>
                            
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                              <span className="flex items-center gap-1">
                                <span className="w-2 h-2 bg-primary rounded-full"></span>
                                {task.project.name}
                              </span>
                              {task.phase && (
                                <span>• {task.phase.name}</span>
                              )}
                              {task.due_date && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {format(new Date(task.due_date), "MMM d")}
                                </span>
                              )}
                            </div>

                            {task.description && (
                              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                                {task.description}
                              </p>
                            )}

                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="sm">
                                <MessageSquare className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="sm">
                                <Paperclip className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          
                          <div className="flex flex-col gap-2">
                            {getActionButton(task)}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Team Snapshot */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Team Snapshot
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback>JD</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">John Doe</p>
                    <p className="text-xs text-muted-foreground">Working on API Integration</p>
                  </div>
                  <div className="w-2 h-2 bg-success rounded-full"></div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback>AS</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Alice Smith</p>
                    <p className="text-xs text-muted-foreground">On break</p>
                  </div>
                  <div className="w-2 h-2 bg-warning rounded-full"></div>
                </div>

                <div className="flex items-center gap-3">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback>MJ</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Mike Johnson</p>
                    <p className="text-xs text-muted-foreground">Offline</p>
                  </div>
                  <div className="w-2 h-2 bg-muted-foreground rounded-full"></div>
                </div>
              </CardContent>
            </Card>

            {/* Points & Rewards */}
            <Card variant="points">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="w-5 h-5" />
                  Rewards & Points
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <p className="text-3xl font-bold">{stats.points}</p>
                  <p className="text-sm opacity-90">Current Points</p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Recent: Task Completion</span>
                    <span className="text-success">+15</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Recent: On-time Delivery</span>
                    <span className="text-success">+10</span>
                  </div>
                </div>

                <Button variant="accent" className="w-full">
                  <ArrowRight className="w-4 h-4" />
                  Visit Shop
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}