import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users, Mail, Calendar } from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";

interface TeamMember {
  user_id: string;
  role: string;
  created_at: string;
  users: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
  };
}

interface TaskStats {
  total: number;
  completed: number;
  inProgress: number;
}

export default function SupervisorDirectReports() {
  const navigate = useNavigate();
  const { organization } = useOrganization();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [taskStats, setTaskStats] = useState<Record<string, TaskStats>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (organization) {
      fetchDirectReports();
    }
  }, [organization]);

  const fetchDirectReports = async () => {
    if (!organization) return;
    
    try {
      // Get current user (supervisor)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Find the team where this supervisor is the lead
      // @ts-ignore - teams table will be available after migration
      const { data: supervisorTeam } = await (supabase as any)
        .from("teams")
        .select("id")
        .eq("organization_id", organization.id)
        .eq("supervisor_id", user.id)
        .maybeSingle();

      if (!supervisorTeam) {
        // Supervisor doesn't have a team yet, show no employees
        setTeamMembers([]);
        setLoading(false);
        return;
      }

      // Get employees who are members of this supervisor's team
      // @ts-ignore - team_members table will be available after migration
      const { data: teamMembersData } = await (supabase as any)
        .from("team_members")
        .select("user_id")
        .eq("team_id", supervisorTeam.id);

      if (!teamMembersData || teamMembersData.length === 0) {
        setTeamMembers([]);
        setLoading(false);
        return;
      }

      const employeeIds = teamMembersData.map(m => m.user_id);

      // Fetch employee details from organization_members
      const { data, error } = await supabase
        .from("organization_members")
        .select(`
          user_id,
          role,
          created_at,
          users!inner(
            id,
            full_name,
            email,
            avatar_url
          )
        `)
        .eq("organization_id", organization.id)
        .eq("role", "employee")
        .in("user_id", employeeIds);

      if (error) throw error;
      setTeamMembers(data as TeamMember[]);

      // Fetch task statistics for each member
      if (data) {
        const stats: Record<string, TaskStats> = {};
        for (const member of data) {
          const { data: tasks } = await supabase
            .from("tasks")
            .select("status, project:projects!inner(organization_id)")
            .eq("project.organization_id", organization.id)
            .eq("assignee_id", member.user_id);

          stats[member.user_id] = {
            total: tasks?.length || 0,
            completed: tasks?.filter(t => t.status === "done").length || 0,
            inProgress: tasks?.filter(t => t.status === "in_progress").length || 0,
          };
        }
        setTaskStats(stats);
      }
    } catch (error) {
      console.error("Error fetching direct reports:", error);
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
              <h1 className="text-xl font-semibold">Direct Reports</h1>
              <p className="text-sm text-muted-foreground">Monitor your team members and their performance</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Direct Reports ({teamMembers.length})
            </CardTitle>
            <CardDescription>
              Your team members and their current task status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {teamMembers.map((member) => {
                const stats = taskStats[member.user_id] || { total: 0, completed: 0, inProgress: 0 };
                return (
                  <div
                    key={member.user_id}
                    className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={member.users.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {member.users.full_name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold">{member.users.full_name}</h3>
                            <Badge variant="outline">{member.role}</Badge>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {member.users.email}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Joined {new Date(member.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-4 text-center">
                        <div>
                          <p className="text-2xl font-bold">{stats.total}</p>
                          <p className="text-xs text-muted-foreground">Total</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-primary">{stats.inProgress}</p>
                          <p className="text-xs text-muted-foreground">In Progress</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-success">{stats.completed}</p>
                          <p className="text-xs text-muted-foreground">Completed</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {teamMembers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No direct reports found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
