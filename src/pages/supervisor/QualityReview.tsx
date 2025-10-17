import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

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
        .eq("status", "submitted")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setCompletedTasks(data as any);
    } catch (error) {
      console.error("Error fetching completed tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: "done" })
        .eq("id", taskId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Task approved and marked as complete",
      });

      fetchCompletedTasks();
    } catch (error) {
      console.error("Error approving task:", error);
      toast({
        title: "Error",
        description: "Failed to approve task",
        variant: "destructive",
      });
    }
  };

  const handleReject = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: "todo" })
        .eq("id", taskId);

      if (error) throw error;

      toast({
        title: "Task Returned",
        description: "Task has been sent back for revision",
      });

      fetchCompletedTasks();
    } catch (error) {
      console.error("Error rejecting task:", error);
      toast({
        title: "Error",
        description: "Failed to reject task",
        variant: "destructive",
      });
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
              Submitted Tasks Awaiting Review ({completedTasks.length})
            </CardTitle>
            <CardDescription>
              Review submitted work and approve or request changes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {completedTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-muted-foreground">{task.project.name}</span>
                      {task.assignee && (
                        <>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-sm text-muted-foreground">
                            {task.assignee.full_name}
                          </span>
                        </>
                      )}
                      <Badge variant={task.priority === "high" ? "destructive" : "default"}>
                        {task.priority}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReject(task.id)}
                    >
                      <AlertCircle className="w-4 h-4 mr-2" />
                      Request Changes
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleApprove(task.id)}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Approve
                    </Button>
                  </div>
                </div>
              ))}
              {completedTasks.length === 0 && (
                <div className="text-center py-12">
                  <CheckCircle2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No tasks awaiting review</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
