import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/enhanced-card";
import { Button } from "@/components/ui/enhanced-button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  CheckCircle2, 
  AlertTriangle, 
  Flag, 
  MessageSquare, 
  Paperclip, 
  Clock,
  Calendar,
  AlertCircle
} from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { format, isToday, isTomorrow, isPast } from "date-fns";

interface Task extends Tables<"tasks"> {
  project: {
    name: string;
    organization_id: string;
  };
  phase?: {
    name: string;
  };
}

export function DueToday() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDueTasks();
  }, []);

  const fetchDueTasks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          project:projects!inner(name, organization_id),
          phase:phases(name)
        `)
        .eq("assignee_id", user.id)
        .neq("status", "done")
        .gte('due_date', today.toISOString().split('T')[0])
        .lt('due_date', tomorrow.toISOString().split('T')[0])
        .order("priority", { ascending: false })
        .order("due_date", { ascending: true });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error("Error fetching due tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskAction = async (taskId: string, action: "start" | "pause" | "complete") => {
    try {
      let newStatus: string;
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
        default:
          newStatus = "todo";
      }

      const { error } = await supabase
        .from("tasks")
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq("id", taskId);

      if (error) throw error;

      // Create time log entry
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("time_logs")
          .insert({
            task_id: taskId,
            user_id: user.id,
            action: action === "complete" ? "complete" : action,
            timestamp: new Date().toISOString()
          });
      }

      await fetchDueTasks();
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
            <Play className="w-3 h-3 mr-1" />
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
              <Pause className="w-3 h-3 mr-1" />
              Pause
            </Button>
            <Button
              variant="complete"
              size="sm"
              onClick={() => handleTaskAction(task.id, "complete")}
            >
              <CheckCircle2 className="w-3 h-3 mr-1" />
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

  const getDueStatus = (dueDate: string) => {
    const date = new Date(dueDate);
    if (isPast(date) && !isToday(date)) {
      return { label: "Overdue", variant: "destructive" as const };
    }
    if (isToday(date)) {
      return { label: "Due Today", variant: "default" as const };
    }
    if (isTomorrow(date)) {
      return { label: "Due Tomorrow", variant: "secondary" as const };
    }
    return { label: `Due ${format(date, "MMM d")}`, variant: "outline" as const };
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
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/employee">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-semibold">Due Today</h1>
              <p className="text-sm text-muted-foreground">Tasks due today and upcoming</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card variant="interactive" className="bg-red-50 border-red-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-700">Overdue</p>
                  <p className="text-2xl font-bold text-red-900">
                    {tasks.filter(t => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date))).length}
                  </p>
                </div>
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card variant="interactive" className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-700">Due Today</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {tasks.filter(t => t.due_date && isToday(new Date(t.due_date))).length}
                  </p>
                </div>
                <Calendar className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card variant="interactive" className="bg-green-50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700">Upcoming</p>
                  <p className="text-2xl font-bold text-green-900">
                    {tasks.filter(t => t.due_date && !isToday(new Date(t.due_date)) && !isPast(new Date(t.due_date))).length}
                  </p>
                </div>
                <Clock className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tasks List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Tasks by Due Date
            </CardTitle>
            <CardDescription>
              {tasks.length} task{tasks.length !== 1 ? 's' : ''} with upcoming due dates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {tasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No tasks due soon</p>
                <p className="text-sm">Great job staying ahead!</p>
              </div>
            ) : (
              tasks.map((task) => {
                const dueStatus = task.due_date ? getDueStatus(task.due_date) : null;
                
                return (
                  <Card key={task.id} variant="interactive" className={cn(
                    "border-l-4",
                    dueStatus?.variant === "destructive" && "border-l-red-500",
                    dueStatus?.variant === "default" && "border-l-blue-500",
                    dueStatus?.variant === "secondary" && "border-l-green-500"
                  )}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-medium">{task.title}</h4>
                            <Badge 
                              variant="outline" 
                              className={cn("text-xs", 
                                task.status === "in_progress" && "bg-primary text-primary-foreground",
                                task.status === "blocked" && "bg-destructive text-destructive-foreground",
                                task.status === "todo" && "bg-muted text-muted-foreground"
                              )}
                            >
                              {task.status.replace("_", " ")}
                            </Badge>
                            {dueStatus && (
                              <Badge variant={dueStatus.variant} className="text-xs">
                                {dueStatus.label}
                              </Badge>
                            )}
                            {task.priority === "urgent" && (
                              <Badge variant="destructive" className="text-xs">
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
                                {format(new Date(task.due_date), "MMM d, yyyy 'at' h:mm a")}
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
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}