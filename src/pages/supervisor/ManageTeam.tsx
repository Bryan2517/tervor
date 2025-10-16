import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Users, Eye, Search } from "lucide-react";

type UserRole = "owner" | "admin" | "supervisor" | "employee";

interface TeamMember {
  user_id: string;
  role: UserRole;
  users: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
  };
}

export default function SupervisorManageTeam() {
  const navigate = useNavigate();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  const fetchTeamMembers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's organization
      const { data: orgMember } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .eq("role", "supervisor")
        .single();

      if (!orgMember) return;
      setOrganizationId(orgMember.organization_id);

      // Fetch team members (employees only for supervisor)
      const { data, error } = await supabase
        .from("organization_members")
        .select(`
          user_id,
          role,
          users!inner(
            id,
            full_name,
            email,
            avatar_url
          )
        `)
        .eq("organization_id", orgMember.organization_id)
        .eq("role", "employee");

      if (error) throw error;
      setTeamMembers(data as TeamMember[]);
    } catch (error) {
      console.error("Error fetching team members:", error);
    } finally {
      setLoading(false);
    }
  };

  const getRoleIcon = (role: UserRole) => {
    if (role === "supervisor") return <Eye className="w-4 h-4" />;
    return <Users className="w-4 h-4" />;
  };

  const filteredMembers = useMemo(() => {
    if (!searchQuery) return teamMembers;
    const query = searchQuery.toLowerCase();
    return teamMembers.filter(m => 
      m.users.full_name.toLowerCase().includes(query) ||
      m.users.email.toLowerCase().includes(query)
    );
  }, [teamMembers, searchQuery]);

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
              <h1 className="text-xl font-semibold">Manage Team</h1>
              <p className="text-sm text-muted-foreground">View and monitor your team members</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Team Members ({filteredMembers.length})
            </CardTitle>
            <CardDescription>
              Your direct reports and employees under your supervision
            </CardDescription>
            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredMembers.map((member) => (
                <div
                  key={member.user_id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={member.users.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {member.users.full_name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{member.users.full_name}</p>
                      <p className="text-sm text-muted-foreground">{member.users.email}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="flex items-center gap-2">
                    {getRoleIcon(member.role)}
                    {member.role}
                  </Badge>
                </div>
              ))}
              {filteredMembers.length === 0 && teamMembers.length > 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No team members match your search
                </div>
              )}
              {teamMembers.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No team members found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
