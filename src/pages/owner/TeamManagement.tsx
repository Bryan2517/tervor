import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Users, Crown, Shield, Eye, User, Search, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type UserRole = "owner" | "admin" | "supervisor" | "employee";

interface TeamMember {
  user_id: string;
  role: UserRole;
  user: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
  };
}

export function TeamManagement() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  const fetchTeamMembers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: orgData } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .eq("role", "owner")
        .single();

      if (orgData) {
        setOrganizationId(orgData.organization_id);
        
        const { data } = await supabase
          .from("organization_members")
          .select(`
            user_id,
            role,
            user:users(id, full_name, email, avatar_url)
          `)
          .eq("organization_id", orgData.organization_id)
          .order("role");

        if (data) {
          setMembers(data as unknown as TeamMember[]);
        }
      }
    } catch (error) {
      console.error("Error fetching team members:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      const { error } = await supabase
        .from("organization_members")
        .update({ role: newRole })
        .eq("organization_id", organizationId)
        .eq("user_id", userId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Member role updated successfully",
      });

      fetchTeamMembers();
    } catch (error) {
      console.error("Error updating role:", error);
      toast({
        title: "Error",
        description: "Failed to update member role",
        variant: "destructive",
      });
    }
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      await supabase.rpc("remove_member", {
        p_org: organizationId,
        p_user: userId,
      });

      toast({
        title: "Success",
        description: "Member removed from organization",
      });

      fetchTeamMembers();
    } catch (error) {
      console.error("Error removing member:", error);
      toast({
        title: "Error",
        description: "Failed to remove member",
        variant: "destructive",
      });
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case "owner":
        return <Crown className="w-4 h-4" />;
      case "admin":
        return <Shield className="w-4 h-4" />;
      case "supervisor":
        return <Eye className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };

  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case "owner":
        return "default";
      case "admin":
        return "secondary";
      case "supervisor":
        return "outline";
      default:
        return "outline";
    }
  };

  const filteredMembers = useMemo(() => {
    let filtered = members;
    
    if (filterRole !== "all") {
      filtered = filtered.filter(m => m.role === filterRole);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(m =>
        m.user.full_name.toLowerCase().includes(query) ||
        m.user.email.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [members, filterRole, searchQuery]);

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
              <h1 className="text-xl font-semibold">Team Management</h1>
              <p className="text-sm text-muted-foreground">Manage team members and their roles</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Team Members ({filteredMembers.length})
                </CardTitle>
                <CardDescription>
                  View and manage organization members
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <Select value={filterRole} onValueChange={setFilterRole}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter by role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="supervisor">Supervisor</SelectItem>
                    <SelectItem value="employee">Employee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
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
              {filteredMembers.length === 0 && members.length > 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No team members match your filters
                </div>
              )}
              {filteredMembers.map((member) => (
                <div
                  key={member.user_id}
                  className="flex items-center justify-between p-4 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <Avatar>
                      <AvatarImage src={member.user.avatar_url} />
                      <AvatarFallback>
                        {member.user.full_name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{member.user.full_name}</p>
                      <p className="text-sm text-muted-foreground">{member.user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant={getRoleBadgeVariant(member.role)} className="gap-1">
                      {getRoleIcon(member.role)}
                      {member.role}
                    </Badge>
                    {member.role !== "owner" && (
                      <>
                        <Select
                          value={member.role}
                          onValueChange={(value) => handleRoleChange(member.user_id, value as UserRole)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="supervisor">Supervisor</SelectItem>
                            <SelectItem value="employee">Employee</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRemoveMember(member.user_id)}
                        >
                          Remove
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
