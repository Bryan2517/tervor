import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ArrowLeft, 
  FolderOpen, 
  Users, 
  Calendar, 
  Target, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  TrendingUp,
  User,
  Search,
  Filter,
  Circle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Project {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  organization_id: string;
  owner_id: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'blocked' | 'done' | 'overdue' | 'review';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: string;
  created_at: string;
  assignee_id?: string;
  assignee?: {
    full_name: string;
    email: string;
  };
}

interface ProjectStats {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  progressPercentage: number;
}

export function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<ProjectStats>({
    totalTasks: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    overdueTasks: 0,
    progressPercentage: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredTasks = useMemo(() => {
    let list = tasks;
    if (filterStatus !== "all") {
      list = list.filter(t => t.status === filterStatus);
    }
    if (filterPriority !== "all") {
      list = list.filter(t => t.priority === filterPriority);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.description ? t.description.toLowerCase().includes(q) : false) ||
        (t.assignee?.full_name ? t.assignee.full_name.toLowerCase().includes(q) : false)
      );
    }
    return list;
  }, [tasks, filterStatus, filterPriority, searchQuery]);

  useEffect(() => {
    if (projectId) {
      fetchProjectDetails();
    }
  }, [projectId]);

  const fetchProjectDetails = async () => {
    try {
      // Fetch project details
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (projectError) throw projectError;
      setProject(projectData);

      // Fetch project tasks with assignee information
      const { data: tasksData, error: tasksError } = await supabase
        .from("tasks")
        .select(`
          id,
          title,
          description,
          status,
          priority,
          due_date,
          created_at,
          assignee_id,
          assignee:users!tasks_assignee_id_fkey(
            full_name,
            email
          )
        `)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (tasksError) throw tasksError;
      setTasks(tasksData || []);

      // Calculate project statistics
      const totalTasks = tasksData?.length || 0;
      const completedTasks = tasksData?.filter(task => task.status === 'done').length || 0;
      const inProgressTasks = tasksData?.filter(task => task.status === 'in_progress').length || 0;
      const overdueTasks = tasksData?.filter(task => task.status === 'overdue').length || 0;
      const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      setStats({
        totalTasks,
        completedTasks,
        inProgressTasks,
        overdueTasks,
        progressPercentage,
      });

    } catch (error) {
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
      case "high": 
        return "destructive";
      case "medium": 
        return "default";
      case "low": 
        return "secondary";
      default: 
        return "outline";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "done": 
        return "bg-success/10 text-success";
      case "in_progress": 
        return "bg-primary/10 text-primary";
      case "review":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300";
      case "todo": 
        return "bg-muted text-muted-foreground";
      case "overdue": 
        return "bg-destructive/10 text-destructive";
      case "blocked":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300";
      default: 
        return "bg-muted text-muted-foreground";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "todo":
        return <Circle className="w-4 h-4 text-muted-foreground" />;
      case "in_progress":
        return <Clock className="w-4 h-4 text-primary" />;
      case "review":
        return <AlertCircle className="w-4 h-4 text-blue-500" />;
      case "done":
        return <CheckCircle2 className="w-4 h-4 text-success" />;
      case "overdue":
        return <AlertCircle className="w-4 h-4 text-destructive" />;
      case "blocked":
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
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
          <h2 className="text-2xl font-semibold mb-2">Project not found</h2>
          <p className="text-muted-foreground mb-4">The project you're looking for doesn't exist.</p>
          <Button onClick={() => navigate("/owner/projects")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Projects
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/owner/projects")}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold flex items-center gap-2">
                  <FolderOpen className="w-6 h-6" />
                  {project.name}
                </h1>
                <p className="text-sm text-muted-foreground">Project Details</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {/* Project Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Project Info */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Project Information</CardTitle>
                <CardDescription>
                  {project.description || "No description provided"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Created</p>
                    <p className="font-medium">{new Date(project.created_at).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last Updated</p>
                    <p className="font-medium">{new Date(project.updated_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Progress Overview */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Overall Progress</span>
                      <span>{stats.progressPercentage}%</span>
                    </div>
                    <Progress value={stats.progressPercentage} className="h-2" />
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Tasks</span>
                      <span className="font-medium">{stats.totalTasks}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Completed</span>
                      <span className="font-medium text-green-600">{stats.completedTasks}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">In Progress</span>
                      <span className="font-medium text-blue-600">{stats.inProgressTasks}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Overdue</span>
                      <span className="font-medium text-red-600">{stats.overdueTasks}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Tasks Section - Updated to match TasksOverview */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search tasks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Priority</label>
                <Select value={filterPriority} onValueChange={setFilterPriority}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Priorities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Project Tasks ({filteredTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredTasks.length === 0 && tasks.length > 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No tasks match your filters
                </div>
              )}
              {filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    {getStatusIcon(task.status)}
                    <div className="flex-1">
                      <p className="font-medium">{task.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {task.assignee && (
                          <>
                            <span className="text-xs text-muted-foreground">
                              Assigned to {task.assignee.full_name}
                            </span>
                          </>
                        )}
                        {task.due_date && (
                          <>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className={`text-xs ${
                              task.status === 'overdue' ? 'text-destructive font-medium' : 'text-muted-foreground'
                            }`}>
                              Due: {new Date(task.due_date).toLocaleDateString()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge variant={getPriorityColor(task.priority)}>
                      {task.priority}
                    </Badge>
                    <Badge className={getStatusColor(task.status)}>
                      {task.status.replace("_", " ")}
                    </Badge>
                  </div>
                </div>
              ))}

              {tasks.length === 0 && (
                <div className="text-center py-12">
                  <Target className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No tasks found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}