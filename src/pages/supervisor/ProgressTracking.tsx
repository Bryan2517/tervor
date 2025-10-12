import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, Target, CheckCircle2 } from "lucide-react";

interface ProgressStats {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  todoTasks: number;
  completionRate: number;
}

export default function SupervisorProgressTracking() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<ProgressStats>({
    totalTasks: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    todoTasks: 0,
    completionRate: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProgressStats();
  }, []);

  const fetchProgressStats = async () => {
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
        .select("status, project:projects!inner(organization_id)")
        .eq("project.organization_id", orgMember.organization_id);

      if (error) throw error;

      const totalTasks = data?.length || 0;
      const completedTasks = data?.filter((t) => t.status === "done").length || 0;
      const inProgressTasks = data?.filter((t) => t.status === "in_progress").length || 0;
      const todoTasks = data?.filter((t) => t.status === "todo").length || 0;
      const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      setStats({
        totalTasks,
        completedTasks,
        inProgressTasks,
        todoTasks,
        completionRate,
      });
    } catch (error) {
      console.error("Error fetching progress stats:", error);
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
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold">Progress Tracking</h1>
              <p className="text-sm text-muted-foreground">Monitor team progress and performance</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5" />
                Total Tasks
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">{stats.totalTasks}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-success" />
                Completed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-success">{stats.completedTasks}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                In Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-primary">{stats.inProgressTasks}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-warning" />
                To Do
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-warning">{stats.todoTasks}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Completion Rate</CardTitle>
            <CardDescription>Overall task completion percentage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Progress</span>
                <span className="text-2xl font-bold">{stats.completionRate}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-4">
                <div
                  className="bg-success h-4 rounded-full transition-all"
                  style={{ width: `${stats.completionRate}%` }}
                ></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
