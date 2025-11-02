import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, TrendingUp, Users, Target, Award } from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";

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
  taskCompletionTrend: Array<{
    date: string;
    completed: number;
    total: number;
  }>;
  projectStatusDistribution: Array<{
    status: string;
    count: number;
    color: string;
  }>;
  pointsDistribution: Array<{
    range: string;
    count: number;
  }>;
}

export function Analytics() {
  const navigate = useNavigate();
  const { organization } = useOrganization();
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalMembers: 0,
    activeProjects: 0,
    completedTasks: 0,
    totalPoints: 0,
    topPerformers: [],
    taskCompletionTrend: [],
    projectStatusDistribution: [],
    pointsDistribution: [],
  });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<"week" | "month" | "year">("month");

  useEffect(() => {
    if (organization) {
      fetchAnalytics();
    }
  }, [dateRange, organization]);

  const fetchAnalytics = async () => {
    if (!organization) return;
    
    try {

      // Fetch basic stats
      const [membersData, projectsData, tasksData, allTasksData] = await Promise.all([
        supabase
          .from("organization_members")
          .select("id")
          .eq("organization_id", organization.id),
        supabase
          .from("projects")
          .select("id")
          .eq("organization_id", organization.id),
        supabase
          .from("tasks")
          .select("status, priority, project:projects!inner(organization_id)")
          .eq("project.organization_id", organization.id)
          .eq("status", "done"),
        supabase
          .from("tasks")
          .select("status, priority, created_at, project:projects!inner(organization_id)")
          .eq("project.organization_id", organization.id)
      ]);

      // Get leaderboard for top performers based on date range
      const getDateRangeForLeaderboard = () => {
        const today = new Date();
        if (dateRange === "week") {
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          return weekAgo.toISOString();
        } else if (dateRange === "month") {
          const monthAgo = new Date(today);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          return monthAgo.toISOString();
        } else if (dateRange === "year") {
          const yearAgo = new Date(today);
          yearAgo.setFullYear(yearAgo.getFullYear() - 1);
          return yearAgo.toISOString();
        }
        return null;
      };

      const leaderboardDateFilter = getDateRangeForLeaderboard();
      const { data: leaderboardData } = await supabase.rpc("get_leaderboard", {
        p_org: organization.id,
        p_since: leaderboardDateFilter,
      });

      const totalPoints = tasksData.data?.reduce((sum, task) => {
        const points = task.priority === "high" ? 3 : task.priority === "medium" ? 2 : 1;
        return sum + points;
      }, 0) || 0;

      // Generate task completion trend data based on date range
      const taskCompletionTrend = [];
      const today = new Date();
      
      if (dateRange === "week") {
        // Last 7 days
        for (let i = 6; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          
          const completedOnDate = allTasksData.data?.filter(task => 
            task.status === 'done' && 
            task.created_at?.startsWith(dateStr)
          ).length || 0;
          
          const totalOnDate = allTasksData.data?.filter(task => 
            task.created_at?.startsWith(dateStr)
          ).length || 0;

          taskCompletionTrend.push({
            date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            completed: completedOnDate,
            total: totalOnDate
          });
        }
      } else if (dateRange === "month") {
        // Last 12 weeks (grouped by week)
        for (let i = 11; i >= 0; i--) {
          const weekStart = new Date(today);
          weekStart.setDate(weekStart.getDate() - (i * 7));
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);
          
          const weekStartStr = weekStart.toISOString().split('T')[0];
          const weekEndStr = weekEnd.toISOString().split('T')[0];
          
          const completedInWeek = allTasksData.data?.filter(task => 
            task.status === 'done' && 
            task.created_at >= weekStartStr && 
            task.created_at <= weekEndStr
          ).length || 0;
          
          const totalInWeek = allTasksData.data?.filter(task => 
            task.created_at >= weekStartStr && 
            task.created_at <= weekEndStr
          ).length || 0;

          taskCompletionTrend.push({
            date: `Week ${12 - i}`,
            completed: completedInWeek,
            total: totalInWeek
          });
        }
      } else if (dateRange === "year") {
        // Last 12 months
        for (let i = 11; i >= 0; i--) {
          const monthStart = new Date(today.getFullYear(), today.getMonth() - i, 1);
          const monthEnd = new Date(today.getFullYear(), today.getMonth() - i + 1, 0);
          
          const monthStartStr = monthStart.toISOString().split('T')[0];
          const monthEndStr = monthEnd.toISOString().split('T')[0];
          
          const completedInMonth = allTasksData.data?.filter(task => 
            task.status === 'done' && 
            task.created_at >= monthStartStr && 
            task.created_at <= monthEndStr
          ).length || 0;
          
          const totalInMonth = allTasksData.data?.filter(task => 
            task.created_at >= monthStartStr && 
            task.created_at <= monthEndStr
          ).length || 0;

          taskCompletionTrend.push({
            date: monthStart.toLocaleDateString('en-US', { month: 'short' }),
            completed: completedInMonth,
            total: totalInMonth
          });
        }
      }

      // Generate project status distribution based on date range
      const getDateRangeFilter = () => {
        const today = new Date();
        if (dateRange === "week") {
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          return weekAgo.toISOString().split('T')[0];
        } else if (dateRange === "month") {
          const monthAgo = new Date(today);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          return monthAgo.toISOString().split('T')[0];
        } else if (dateRange === "year") {
          const yearAgo = new Date(today);
          yearAgo.setFullYear(yearAgo.getFullYear() - 1);
          return yearAgo.toISOString().split('T')[0];
        }
        return null;
      };

      const dateFilter = getDateRangeFilter();
      const filteredTasks = dateFilter ? 
        allTasksData.data?.filter(task => task.created_at >= dateFilter) || [] : 
        allTasksData.data || [];

      const projectStatusDistribution = [
        { status: 'Active', count: projectsData.data?.length || 0, color: '#3b82f6' },
        { status: 'Completed', count: filteredTasks.filter(t => t.status === 'done').length, color: '#10b981' },
        { status: 'Todo', count: filteredTasks.filter(t => t.status === 'todo').length, color: '#f59e0b' },
        { status: 'In Progress', count: filteredTasks.filter(t => t.status === 'in_progress').length, color: '#8b5cf6' }
      ];

      // Generate points distribution based on top performers
      const pointsDistribution = [
        { range: '0-10', count: leaderboardData?.filter(p => p.total_points <= 10).length || 0 },
        { range: '11-25', count: leaderboardData?.filter(p => p.total_points > 10 && p.total_points <= 25).length || 0 },
        { range: '26-50', count: leaderboardData?.filter(p => p.total_points > 25 && p.total_points <= 50).length || 0 },
        { range: '51+', count: leaderboardData?.filter(p => p.total_points > 50).length || 0 }
      ];

      setAnalytics({
        totalMembers: membersData.data?.length || 0,
        activeProjects: projectsData.data?.length || 0,
        completedTasks: tasksData.data?.length || 0,
        totalPoints,
        topPerformers: leaderboardData?.slice(0, 5) || [],
        taskCompletionTrend,
        projectStatusDistribution,
        pointsDistribution,
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

        {/* Top Performers Card */}
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

