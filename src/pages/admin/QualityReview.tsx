import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  projects: {
    name: string;
  };
  assignee: {
    full_name: string;
  } | null;
}

export function QualityReview() {
  const [reviewTasks, setReviewTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReviewTasks();
  }, []);

  const fetchReviewTasks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: memberData } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .single();

      if (!memberData) return;

      const { data, error } = await supabase
        .from("tasks")
        .select(`
          id,
          title,
          status,
          priority,
          projects!inner(name, organization_id),
          assignee:users!assignee_id(full_name)
        `)
        .eq("projects.organization_id", memberData.organization_id)
        .eq("status", "in_progress")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReviewTasks(data as Task[]);
    } catch (error) {
      console.error("Error fetching review tasks:", error);
      toast({
        title: "Error",
        description: "Failed to load tasks for review",
        variant: "destructive",
      });
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

      fetchReviewTasks();
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
        .update({ status: "in_progress" })
        .eq("id", taskId);

      if (error) throw error;

      toast({
        title: "Task Returned",
        description: "Task has been sent back for revision",
      });

      fetchReviewTasks();
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
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Quality Review</h1>
              <p className="text-sm text-muted-foreground">Review and approve completed tasks</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              Tasks Awaiting Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {reviewTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-medium">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-muted-foreground">{task.projects.name}</span>
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

              {reviewTasks.length === 0 && (
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
