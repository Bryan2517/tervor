import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Target, Clock, CheckCircle2 } from "lucide-react";

type TaskStatus = "todo" | "in_progress" | "done";
type TaskPriority = "low" | "medium" | "high";

interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string;
  assignee_id?: string;
  project: {
    name: string;
  };
  assignee?: {
    full_name: string;
  };
}

export default function SupervisorTaskAssignment() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: orgMember } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .eq("role", "supervisor")
        .single();

      if (!orgMember) return;

      const { data, error } = await supabase
        .from("tasks")
        .select(`
          id,
          title,
          description,
          status,
          priority,
          due_date,
          assignee_id,
          project:projects!inner(name, organization_id),
          assignee:users!tasks_assignee_id_fkey(full_name)
        `)
        .eq("project.organization_id", orgMember.organization_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTasks(data as any);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case "todo":
        return <Clock className="w-4 h-4" />;
      case "in_progress":
        return <Target className="w-4 h-4" />;
      case "done":
        return <CheckCircle2 className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case "todo":
        return "bg-muted";
      case "in_progress":
        return "bg-primary";
      case "done":
        return "bg-success";
    }
  };

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case "low":
        return "bg-muted";
      case "medium":
        return "bg-warning";
      case "high":
        return "bg-destructive";
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
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold">Task Assignment</h1>
              <p className="text-sm text-muted-foreground">Monitor and manage task assignments</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              All Tasks ({tasks.length})
            </CardTitle>
            <CardDescription>
              View and track all tasks in your organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{task.title}</h3>
                      <Badge variant="outline" className={getPriorityColor(task.priority)}>
                        {task.priority}
                      </Badge>
                    </div>
                    {task.description && (
                      <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Project: {task.project.name}</span>
                      {task.assignee && <span>Assignee: {task.assignee.full_name}</span>}
                      {task.due_date && (
                        <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <Badge className={getStatusColor(task.status)}>
                    {getStatusIcon(task.status)}
                    <span className="ml-1">{task.status}</span>
                  </Badge>
                </div>
              ))}
              {tasks.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No tasks found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
