import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Users, Crown, Shield, Eye, User } from "lucide-react";
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
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Team Members ({members.length})
            </CardTitle>
            <CardDescription>
              View and manage organization members
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {members.map((member) => (
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
