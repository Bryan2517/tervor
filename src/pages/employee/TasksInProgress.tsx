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
  Target
} from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { format } from "date-fns";

interface Task extends Tables<"tasks"> {
  project: {
    name: string;
    organization_id: string;
  };
  phase?: {
    name: string;
  };
}

export function TasksInProgress() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "in_progress" | "todo" | "blocked">("all");

  useEffect(() => {
    fetchInProgressTasks();
  }, []);

  const fetchInProgressTasks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          project:projects!inner(name, organization_id),
          phase:phases(name)
        `)
        .eq("assignee_id", user.id)
        .neq("status", "done")
        .order("priority", { ascending: false })
        .order("due_date", { ascending: true });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskAction = async (taskId: string, action: "start" | "pause" | "complete") => {
    try {
      let newStatus: "todo" | "in_progress" | "blocked" | "done";
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

      await fetchInProgressTasks();
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

  const filteredTasks = tasks.filter(task => {
    if (filter === "all") return true;
    return task.status === filter;
  });

  const statusCounts = {
    all: tasks.length,
    in_progress: tasks.filter(t => t.status === "in_progress").length,
    todo: tasks.filter(t => t.status === "todo").length,
    blocked: tasks.filter(t => t.status === "blocked").length,
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
              <h1 className="text-xl font-semibold">Tasks In Progress</h1>
              <p className="text-sm text-muted-foreground">Manage your ongoing tasks</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {[
            { key: "all" as const, label: "All Tasks", count: statusCounts.all },
            { key: "in_progress" as const, label: "In Progress", count: statusCounts.in_progress },
            { key: "todo" as const, label: "To Do", count: statusCounts.todo },
            { key: "blocked" as const, label: "Blocked", count: statusCounts.blocked },
          ].map(({ key, label, count }) => (
            <Button
              key={key}
              variant={filter === key ? "default" : "outline"}
              onClick={() => setFilter(key)}
              className="flex items-center gap-2 whitespace-nowrap"
            >
              {label}
              <Badge variant="secondary" className="ml-1">
                {count}
              </Badge>
            </Button>
          ))}
        </div>

        {/* Tasks List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              {filter === "all" ? "All Active Tasks" : 
               filter === "in_progress" ? "Tasks In Progress" :
               filter === "todo" ? "To Do Tasks" : "Blocked Tasks"}
            </CardTitle>
            <CardDescription>
              {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''} found
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {filteredTasks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No tasks found</p>
                <p className="text-sm">All caught up!</p>
              </div>
            ) : (
              filteredTasks.map((task) => (
                <Card key={task.id} variant="interactive" className="border-l-4 border-l-primary">
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
                              {format(new Date(task.due_date), "MMM d, yyyy")}
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
    </div>
  );
}