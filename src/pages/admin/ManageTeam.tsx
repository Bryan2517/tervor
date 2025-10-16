import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Users, UserCog, Shield, Eye, Filter } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

type UserRole = "owner" | "admin" | "supervisor" | "employee";

interface TeamMember {
  user_id: string;
  role: UserRole;
  users: {
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
}

export function ManageTeam() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [filterRole, setFilterRole] = useState<string>("all");

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  const fetchTeamMembers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);

      const { data: memberData } = await supabase
        .from("organization_members")
        .select("organization_id, role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .single();

      if (!memberData) return;

      setOrganizationId(memberData.organization_id);
      setCurrentUserRole(memberData.role);

      const { data, error } = await supabase
        .from("organization_members")
        .select(`
          user_id,
          role,
          users!inner(
            full_name,
            email,
            avatar_url
          )
        `)
        .eq("organization_id", memberData.organization_id)
        .order("role");

      if (error) throw error;
      setMembers(data as TeamMember[]);
    } catch (error) {
      console.error("Error fetching team members:", error);
      toast({
        title: "Error",
        description: "Failed to load team members",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (!organizationId) return;

    try {
      const { error } = await supabase
        .from("organization_members")
        .update({ role: newRole })
        .eq("organization_id", organizationId)
        .eq("user_id", userId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Team member role updated successfully",
      });

      fetchTeamMembers();
    } catch (error) {
      console.error("Error updating role:", error);
      toast({
        title: "Error",
        description: "Failed to update team member role",
        variant: "destructive",
      });
    }
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case "owner":
        return <Shield className="w-4 h-4" />;
      case "admin":
        return <Shield className="w-4 h-4" />;
      case "supervisor":
        return <UserCog className="w-4 h-4" />;
      case "employee":
        return <Users className="w-4 h-4" />;
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
      case "employee":
        return "outline";
    }
  };

  const canChangeRole = (targetUserId: string, targetRole: UserRole) => {
    // Can't change own role
    if (targetUserId === currentUserId) return false;
    
    // Can't change owner or admin roles (admin can only manage supervisor and employee)
    if (targetRole === "owner" || targetRole === "admin") return false;
    
    return true;
  };

  const filteredMembers = useMemo(() => {
    if (filterRole === "all") return members;
    return members.filter(m => m.role === filterRole);
  }, [members, filterRole]);

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
              <h1 className="text-2xl font-bold">Manage Team</h1>
              <p className="text-sm text-muted-foreground">View and manage team member roles</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Team Members ({filteredMembers.length})
              </CardTitle>
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
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredMembers.map((member) => (
                <div
                  key={member.user_id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={member.users.avatar_url || undefined} />
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {member.users.full_name?.substring(0, 2).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{member.users.full_name}</p>
                      <p className="text-sm text-muted-foreground">{member.users.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <Badge variant={getRoleBadgeVariant(member.role)} className="flex items-center gap-1">
                      {getRoleIcon(member.role)}
                      {member.role}
                    </Badge>

                    {canChangeRole(member.user_id, member.role) && (
                      <Select
                        value={member.role}
                        onValueChange={(value) => handleRoleChange(member.user_id, value as UserRole)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="supervisor">Supervisor</SelectItem>
                          <SelectItem value="employee">Employee</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    {!canChangeRole(member.user_id, member.role) && member.user_id === currentUserId && (
                      <span className="text-sm text-muted-foreground">(You)</span>
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
