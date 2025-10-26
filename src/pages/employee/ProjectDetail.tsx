import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  ArrowLeft, 
  FolderOpen, 
  Calendar, 
  Target, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  TrendingUp,
  Circle,
  Coins,
  BarChart3,
  Play,
  Pause
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";

interface Project {
  id: string;
  name: string;
  description?: string;
  due_date?: string;
  created_at: string;
  updated_at: string;
  organization_id: string;
  owner_id: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done' | 'overdue' | 'blocked' | 'submitted';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string;
  created_at: string;
  updated_at: string;
  project_id: string;
  assignee_id?: string;
  completion_points?: number;
}

interface ProjectStats {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  totalPoints: number;
  earnedPoints: number;
}

export function ProjectDetail() {
  const { projectName } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { organization } = useOrganization();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ProjectStats>({
    totalTasks: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    overdueTasks: 0,
    totalPoints: 0,
    earnedPoints: 0,
  });

  useEffect(() => {
    if (projectName && organization) {
      fetchProjectDetails();
    }
  }, [projectName, organization]);

  const fetchProjectDetails = async () => {
    if (!organization || !projectName) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch project details
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("*")
        .eq("name", projectName)
        .eq("organization_id", organization.id)
        .single();

      if (projectError) throw projectError;
      setProject(projectData);

      // Fetch only tasks assigned to this employee
      const { data: tasksData, error: tasksError } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", projectData.id)
        .eq("task_type", "task")
        .eq("assignee_id", user.id)
        .order("created_at", { ascending: false });

      if (tasksError) throw tasksError;

      const fetchedTasks = tasksData || [];
      setTasks(fetchedTasks);

      // Calculate statistics
      const totalTasks = fetchedTasks.length;
      const completedTasks = fetchedTasks.filter(t => t.status === 'done').length;
      const inProgressTasks = fetchedTasks.filter(t => t.status === 'in_progress').length;
      const overdueTasks = fetchedTasks.filter(t => {
        if (!t.due_date || t.status === 'done') return false;
        return new Date(t.due_date) < new Date();
      }).length;
      const totalPoints = fetchedTasks.reduce((sum, t) => sum + (t.completion_points || 0), 0);
      const earnedPoints = fetchedTasks
        .filter(t => t.status === 'done')
        .reduce((sum, t) => sum + (t.completion_points || 0), 0);

      setStats({
        totalTasks,
        completedTasks,
        inProgressTasks,
        overdueTasks,
        totalPoints,
        earnedPoints,
      });

    } catch (error: any) {
      console.error("Error fetching project details:", error);
      toast({
        title: "Error",
        description: "Failed to load project details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'done': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'in_progress': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'todo': return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
      case 'overdue': return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'blocked': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      case 'submitted': return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
      default: return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'high': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
      case 'medium': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'low': return 'bg-green-500/10 text-green-600 border-green-500/20';
      default: return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'done': return <CheckCircle2 className="w-4 h-4" />;
      case 'in_progress': return <Clock className="w-4 h-4" />;
      case 'overdue': return <AlertCircle className="w-4 h-4" />;
      case 'blocked': return <AlertCircle className="w-4 h-4" />;
      default: return <Circle className="w-4 h-4" />;
    }
  };

  const formatStatus = (status: string) => {
    return status.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const handleTaskAction = async (taskId: string, action: "start" | "pause" | "complete") => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let newStatus: 'todo' | 'in_progress' | 'done';
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

      // If completing a task, award points
      if (action === "complete") {
        // Get the task details to check for completion points
        const { data: taskData, error: taskError } = await supabase
          .from("tasks")
          .select("completion_points")
          .eq("id", taskId)
          .single();

        if (taskError) throw taskError;

        // Update task status
        const { error: updateError } = await supabase
          .from("tasks")
          .update({ 
            status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq("id", taskId);

        if (updateError) throw updateError;

        // Award points if the task has completion points
        if (taskData.completion_points && taskData.completion_points > 0) {
          const { error: pointsError } = await supabase
            .from("points_ledger")
            .insert({
              user_id: user.id,
              delta: taskData.completion_points,
              reason_code: "task_completion",
              task_id: taskId,
            });

          if (pointsError) throw pointsError;

          // Show success notification with points earned
          toast({
            title: "Task Completed! 🎉",
            description: `You earned ${taskData.completion_points} points!`,
          });
        } else {
          // Show completion message without points
          toast({
            title: "Task Completed!",
            description: "Great job completing this task!",
          });
        }
      } else {
        // For start and pause, just update the status
        const { error: updateError } = await supabase
          .from("tasks")
          .update({ 
            status: newStatus,
            updated_at: new Date().toISOString()
          })
          .eq("id", taskId);

        if (updateError) throw updateError;
      }

      // Create time log entry
      if (action === "start" || action === "pause" || action === "complete") {
        await supabase
          .from("time_logs")
          .insert({
            task_id: taskId,
            user_id: user.id,
            action: action === "complete" ? "complete" : action,
          });
      }

      // Refresh project details
      await fetchProjectDetails();
    } catch (error) {
      console.error("Error updating task:", error);
      toast({
        title: "Error",
        description: "Failed to update task",
        variant: "destructive",
      });
    }
  };

  const getActionButton = (task: Task) => {
    switch (task.status) {
      case "todo":
        return (
          <Button
            size="sm"
            onClick={() => handleTaskAction(task.id, "start")}
          >
            <Play className="w-3 h-3 mr-1" />
            Start
          </Button>
        );
      case "in_progress":
        return (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleTaskAction(task.id, "pause")}
            >
              <Pause className="w-3 h-3 mr-1" />
              Pause
            </Button>
            <Button
              size="sm"
              onClick={() => handleTaskAction(task.id, "complete")}
            >
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Complete
            </Button>
          </div>
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

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Project not found</h2>
          <Button onClick={() => navigate("/employee/projects")}>Back to Projects</Button>
        </div>
      </div>
    );
  }

  const progressPercentage = stats.totalTasks > 0 
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100) 
    : 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/employee/projects")}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-3">
                <FolderOpen className="w-6 h-6 text-primary" />
                <div>
                  <h1 className="text-xl font-semibold">{project.name}</h1>
                  <p className="text-sm text-muted-foreground">My Tasks</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Project Info */}
        <Card>
          <CardHeader>
            <CardTitle>Project Overview</CardTitle>
            <CardDescription>
              {project.description || "No description provided"}
              {project.due_date && (
                <span className="block mt-2 text-sm">
                  Expected Completion: <span className="font-medium">{new Date(project.due_date).toLocaleDateString()}</span>
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Progress Card */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="w-4 h-4" />
                  <span>Overall Progress</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold">{progressPercentage}%</span>
                    <span className="text-sm text-muted-foreground">
                      {stats.completedTasks}/{stats.totalTasks}
                    </span>
                  </div>
                  <Progress value={progressPercentage} className="h-2" />
                </div>
              </div>

              {/* Points Card */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Coins className="w-4 h-4" />
                  <span>Points</span>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold">{stats.earnedPoints}</div>
                  <div className="text-sm text-muted-foreground">of {stats.totalPoints} total</div>
                </div>
              </div>

              {/* In Progress Card */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  <span>In Progress</span>
                </div>
                <div className="text-2xl font-bold">{stats.inProgressTasks}</div>
              </div>

              {/* Overdue Card */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertCircle className="w-4 h-4" />
                  <span>Overdue</span>
                </div>
                <div className="text-2xl font-bold text-red-600">{stats.overdueTasks}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* My Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              My Tasks ({stats.totalTasks})
            </CardTitle>
            <CardDescription>Tasks assigned to you in this project</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tasks.length === 0 ? (
                <div className="text-center py-12">
                  <Target className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground font-medium mb-2">No tasks assigned</p>
                  <p className="text-sm text-muted-foreground">You don't have any tasks in this project yet</p>
                </div>
              ) : (
                tasks.map((task) => (
                  <div key={task.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="font-semibold text-base">{task.title}</h3>
                          <div className="flex items-center gap-2">
                            <Badge className={`${getStatusColor(task.status)} border`}>
                              {getStatusIcon(task.status)}
                              <span className="ml-1.5">{formatStatus(task.status)}</span>
                            </Badge>
                            <Badge className={`${getPriorityColor(task.priority)} border`}>
                              {task.priority.toUpperCase()}
                            </Badge>
                          </div>
                        </div>
                        
                        {task.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {task.description}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {task.due_date && (
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5" />
                              <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                            </div>
                          )}
                          {task.completion_points && task.completion_points > 0 && (
                            <div className="flex items-center gap-1.5 text-amber-600">
                              <Coins className="w-3.5 h-3.5" />
                              <span>{task.completion_points} points</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="flex flex-col gap-2">
                        {getActionButton(task)}
                      </div>
                    </div>
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

