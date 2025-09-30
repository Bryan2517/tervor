import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Clock, Timer } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

interface TimeLog {
  id: string;
  action: string;
  duration: number | null;
  timestamp: string;
  users: {
    full_name: string;
  };
  tasks: {
    title: string;
    projects: {
      name: string;
    };
  };
}

export function TimeManagement() {
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTimeLogs();
  }, []);

  const fetchTimeLogs = async () => {
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
        .from("time_logs")
        .select(`
          id,
          action,
          duration,
          timestamp,
          users!inner(full_name),
          tasks!inner(
            title,
            projects!inner(name, organization_id)
          )
        `)
        .eq("tasks.projects.organization_id", memberData.organization_id)
        .order("timestamp", { ascending: false })
        .limit(50);

      if (error) throw error;
      setTimeLogs(data as TimeLog[]);
    } catch (error) {
      console.error("Error fetching time logs:", error);
      toast({
        title: "Error",
        description: "Failed to load time logs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number | null) => {
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
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Time Management</h1>
              <p className="text-sm text-muted-foreground">Track time spent on tasks by team members</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Time Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {timeLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <Timer className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium">{log.users.full_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {log.tasks.title} • {log.tasks.projects.name}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">{log.action}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="font-medium">{formatDuration(log.duration)}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}

              {timeLogs.length === 0 && (
                <div className="text-center py-12">
                  <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No time logs found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
