import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, TrendingUp, Users, Target, Award, Calendar } from "lucide-react";

interface AnalyticsData {
  totalMembers: number;
  activeProjects: number;
  completedTasks: number;
  totalPoints: number;
  topPerformers: Array<{
    user_id: string;
    full_name: string;
    total_points: number;
    completed_tasks: number;
  }>;
}

export function Analytics() {
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalMembers: 0,
    activeProjects: 0,
    completedTasks: 0,
    totalPoints: 0,
    topPerformers: [],
  });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<"week" | "month" | "year">("month");

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: orgData } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .eq("role", "owner")
        .single();

      if (!orgData) return;

      // Fetch basic stats
      const [membersData, projectsData, tasksData] = await Promise.all([
        supabase
          .from("organization_members")
          .select("user_id")
          .eq("organization_id", orgData.organization_id),
        supabase
          .from("projects")
          .select("id")
          .eq("organization_id", orgData.organization_id),
        supabase
          .from("tasks")
          .select("status, priority, project:projects!inner(organization_id)")
          .eq("project.organization_id", orgData.organization_id)
          .eq("status", "done")
      ]);

      // Get leaderboard for top performers
      const { data: leaderboardData } = await supabase.rpc("get_leaderboard", {
        p_org: orgData.organization_id,
      });

      const totalPoints = tasksData.data?.reduce((sum, task) => {
        const points = task.priority === "high" ? 3 : task.priority === "medium" ? 2 : 1;
        return sum + points;
      }, 0) || 0;

      setAnalytics({
        totalMembers: membersData.data?.length || 0,
        activeProjects: projectsData.data?.length || 0,
        completedTasks: tasksData.data?.length || 0,
        totalPoints,
        topPerformers: leaderboardData?.slice(0, 5) || [],
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold">Analytics</h1>
                <p className="text-sm text-muted-foreground">Organization performance insights</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={dateRange === "week" ? "default" : "outline"}
                size="sm"
                onClick={() => setDateRange("week")}
              >
                Week
              </Button>
              <Button
                variant={dateRange === "month" ? "default" : "outline"}
                size="sm"
                onClick={() => setDateRange("month")}
              >
                Month
              </Button>
              <Button
                variant={dateRange === "year" ? "default" : "outline"}
                size="sm"
                onClick={() => setDateRange("year")}
              >
                Year
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Members</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold">{analytics.totalMembers}</div>
                <Users className="w-8 h-8 text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Projects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold">{analytics.activeProjects}</div>
                <Target className="w-8 h-8 text-accent" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completed Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold">{analytics.completedTasks}</div>
                <TrendingUp className="w-8 h-8 text-success" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Points</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-3xl font-bold">{analytics.totalPoints}</div>
                <Award className="w-8 h-8 text-warning" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5" />
              Top Performers
            </CardTitle>
            <CardDescription>Team members with highest points this {dateRange}</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.topPerformers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No performance data available yet
              </div>
            ) : (
              <div className="space-y-4">
                {analytics.topPerformers.map((performer, index) => (
                  <div
                    key={performer.user_id}
                    className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center font-bold text-primary">
                        #{index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{performer.full_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {performer.completed_tasks} tasks completed
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">{performer.total_points}</p>
                      <p className="text-xs text-muted-foreground">points</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
