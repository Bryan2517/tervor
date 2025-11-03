import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/enhanced-card";
import { Button } from "@/components/ui/enhanced-button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useOrganization } from "@/contexts/OrganizationContext";
import { ArrowLeft, Users, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Team {
  id: string;
  name: string;
  description?: string;
  supervisor_id?: string;
  created_at: string;
  created_by?: string;
  created_by_user?: {
    id: string;
    email: string;
    full_name?: string;
  };
}

interface TeamMember {
  id: string;
  user_id: string;
  team_id: string;
  users: {
    email: string;
    full_name?: string;
    phone?: string | null;
    role?: string;
  };
}

export default function EmployeeTeams() {
  const navigate = useNavigate();
  const { organization } = useOrganization();
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<Record<string, TeamMember[]>>({});
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [teamMemberCounts, setTeamMemberCounts] = useState<Record<string, number>>({});
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    };
    getCurrentUser();
  }, []);

  useEffect(() => {
    if (organization && currentUserId) {
      fetchTeams();
    }
  }, [organization, currentUserId]);

  const fetchTeams = async () => {
    try {
      if (!organization || !currentUserId) return;

      // First, fetch teams where the employee is a member
      // @ts-ignore - team_members table will be available after migration
      const { data: teamMembersData, error: teamMembersError } = await (supabase as any)
        .from("team_members")
        .select("team_id")
        .eq("user_id", currentUserId);

      if (teamMembersError) throw teamMembersError;

      if (!teamMembersData || teamMembersData.length === 0) {
        setTeams([]);
        setLoading(false);
        return;
      }

      const teamIds = teamMembersData.map((tm: any) => tm.team_id);

      // Fetch the actual teams
      // @ts-ignore - teams table will be available after migration
      const { data: teamsData, error: teamsError } = await (supabase as any)
        .from("teams")
        .select("*")
        .eq("organization_id", organization.id)
        .in("id", teamIds)
        .order("created_at", { ascending: false });

      if (teamsError) throw teamsError;

      // Fetch created_by user details for each team
      if (teamsData && teamsData.length > 0) {
        const createdByIds = teamsData
          .filter((team: any) => team.created_by)
          .map((team: any) => team.created_by);

        if (createdByIds.length > 0) {
          const { data: usersData } = await supabase
            .from("users")
            .select("id, email, full_name")
            .in("id", createdByIds);

          const teamsWithCreator = teamsData.map((team: any) => ({
            ...team,
            created_by_user: usersData?.find((u) => u.id === team.created_by),
          }));

          setTeams(teamsWithCreator);
        } else {
          setTeams(teamsData || []);
        }
      } else {
        setTeams([]);
      }

      // Fetch member counts and members for all teams
      if (teamsData && teamsData.length > 0) {
        const allTeamIds = teamsData.map((t: any) => t.id);
        
        // @ts-ignore
        const { data: allMembersData } = await (supabase as any)
          .from("team_members")
          .select("team_id")
          .in("team_id", allTeamIds);

        if (allMembersData) {
          const counts: Record<string, number> = {};
          allTeamIds.forEach((teamId: string) => {
            counts[teamId] = allMembersData.filter((m: any) => m.team_id === teamId).length;
          });
          setTeamMemberCounts(counts);
        }

        // Fetch member details for all teams
        await fetchAllTeamMembers(allTeamIds);
      }
    } catch (error: any) {
      console.error("Error fetching teams:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllTeamMembers = async (teamIds: string[]) => {
    try {
      // @ts-ignore - team_members table will be available after migration
      const { data: membersData, error } = await (supabase as any)
        .from("team_members")
        .select("*")
        .in("team_id", teamIds);

      if (error) throw error;

      if (membersData && membersData.length > 0) {
        // Fetch user details for each member
        const userIds = membersData.map((m: any) => m.user_id);
        const { data: usersData } = await supabase
          .from("users")
          .select("id, email, full_name, phone")
          .in("id", userIds);

        // Group members by team_id
        const membersByTeam: Record<string, TeamMember[]> = {};
        teamIds.forEach((teamId) => {
          membersByTeam[teamId] = [];
        });

        membersData.forEach((member: any) => {
          const user = usersData?.find((u) => u.id === member.user_id);
          if (user) {
            membersByTeam[member.team_id].push({
              ...member,
              users: user,
            });
          }
        });

        setSelectedTeamMembers(membersByTeam);
      }
    } catch (error: any) {
      console.error("Error fetching team members:", error);
    }
  };

  const getRoleIcon = (role?: string) => {
    if (role === "supervisor") return <Eye className="w-4 h-4" />;
    return <Users className="w-4 h-4" />;
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
              <h1 className="text-xl font-semibold">My Teams</h1>
              <p className="text-sm text-muted-foreground">
                View all teams you're a part of
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Teams List */}
          <div className="lg:col-span-2 space-y-4">
            {teams.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">No Teams Yet</h3>
                  <p className="text-muted-foreground mb-4">
                    You haven't been assigned to any teams yet
                  </p>
                </CardContent>
              </Card>
            ) : (
              teams.map((team) => (
                <Card
                  key={team.id}
                  variant="interactive"
                  className="cursor-pointer"
                  onClick={() => setSelectedTeam(team)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">
                          <Users className="w-5 h-5" />
                          {team.name}
                        </CardTitle>
                        <CardDescription>
                          {team.description || "No description provided"}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Badge variant="outline">
                          {teamMemberCounts[team.id] || 0} members
                        </Badge>
                        {team.created_by_user && (
                          <div className="text-sm text-muted-foreground">
                            Created by: <span className="font-medium">{team.created_by_user.full_name || team.created_by_user.email}</span>
                          </div>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedTeam(team)}
                      >
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Team Details Sidebar */}
          <div>
            {selectedTeam ? (
              <Card>
                <CardHeader>
                  <CardTitle>{selectedTeam.name}</CardTitle>
                  <CardDescription>Team Members</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {!selectedTeamMembers[selectedTeam.id] || selectedTeamMembers[selectedTeam.id].length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No team members yet.
                      </p>
                    ) : (
                      selectedTeamMembers[selectedTeam.id].map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-2 rounded-lg border"
                        >
                          <div className="flex items-center gap-2">
                            <Avatar className="w-8 h-8">
                              <AvatarFallback className="text-xs">
                                {member.users.email.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">
                                {member.users.full_name || member.users.email}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {member.users.email}
                              </p>
                              {member.users.phone && (
                                <p className="text-xs text-muted-foreground">
                                  {member.users.phone}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-sm text-muted-foreground">
                    Select a team to view its members
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

