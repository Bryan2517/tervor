import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock } from "lucide-react";

interface TimeLog {
  id: string;
  user_id: string;
  task_id: string;
  action: string;
  timestamp: string;
  duration?: number;
  task: {
    title: string;
  };
  user: {
    full_name: string;
  };
}

export default function SupervisorTimeManagement() {
  const navigate = useNavigate();
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTimeLogs();
  }, []);

  const fetchTimeLogs = async () => {
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
        .from("time_logs")
        .select(`
          id,
          user_id,
          task_id,
          action,
          timestamp,
          duration,
          task:tasks!inner(title, project:projects!inner(organization_id)),
          user:users(full_name)
        `)
        .eq("task.project.organization_id", orgMember.organization_id)
        .order("timestamp", { ascending: false })
        .limit(50);

      if (error) throw error;
      setTimeLogs(data as TimeLog[]);
    } catch (error) {
      console.error("Error fetching time logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "N/A";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
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
              <h1 className="text-xl font-semibold">Time Management</h1>
              <p className="text-sm text-muted-foreground">Track time spent on tasks</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Recent Time Logs
            </CardTitle>
            <CardDescription>
              View time tracking activity across your team
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {timeLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-semibold">{log.task.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {log.user.full_name} • {log.action}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{formatDuration(log.duration)}</p>
                  </div>
                </div>
              ))}
              {timeLogs.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No time logs found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
