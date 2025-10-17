import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, Star } from "lucide-react";

type TaskPriority = "low" | "medium" | "high";

interface CompletedTask {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  created_at: string;
  updated_at: string;
  project: {
    name: string;
  };
  assignee?: {
    full_name: string;
  };
}

export default function SupervisorQualityReview() {
  const navigate = useNavigate();
  const [completedTasks, setCompletedTasks] = useState<CompletedTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCompletedTasks();
  }, []);

  const fetchCompletedTasks = async () => {
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
          priority,
          created_at,
          updated_at,
          project:projects!inner(name, organization_id),
          assignee:users!tasks_assignee_id_fkey(full_name)
        `)
        .eq("project.organization_id", orgMember.organization_id)
        .eq("status", "done")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setCompletedTasks(data as any);
    } catch (error) {
      console.error("Error fetching completed tasks:", error);
    } finally {
      setLoading(false);
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
              <h1 className="text-xl font-semibold">Quality Review</h1>
              <p className="text-sm text-muted-foreground">Review completed tasks</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              Completed Tasks ({completedTasks.length})
            </CardTitle>
            <CardDescription>
              Review and assess the quality of completed work
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {completedTasks.map((task) => (
                <div
                  key={task.id}
                  className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
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
                        {task.assignee && <span>Completed by: {task.assignee.full_name}</span>}
                        <span>Completed: {new Date(task.updated_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star key={star} className="w-4 h-4 text-warning fill-warning" />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
              {completedTasks.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No completed tasks to review
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
