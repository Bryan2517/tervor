import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/enhanced-card";
import { Button } from "@/components/ui/enhanced-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { createUserManagementHandlers } from "@/lib/user-management";
import { 
  Users, 
  UserPlus, 
  UserMinus, 
  Crown, 
  Shield, 
  UserCheck, 
  UserX,
  Mail,
  MoreHorizontal
} from "lucide-react";

type UserRole = "owner" | "admin" | "supervisor" | "employee";

interface OrganizationMember {
  user_id: string;
  role: UserRole;
  created_at: string;
  users: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
  };
}

interface UserManagementProps {
  organizationId: string;
  currentUserId: string;
  currentUserRole: UserRole;
}

export function UserManagement({ organizationId, currentUserId, currentUserRole }: UserManagementProps) {
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [newInvite, setNewInvite] = useState({
    email: "",
    role: "employee" as UserRole,
  });
  const [transferTo, setTransferTo] = useState("");
  const { toast } = useToast();

  const userManagement = createUserManagementHandlers(organizationId, currentUserId, currentUserRole, toast);

  useEffect(() => {
    fetchMembers();
  }, [organizationId]);

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('organization_members')
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
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error('Error fetching members:', error);
      toast({
        title: "Error",
        description: "Failed to load organization members",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInviteUser = async () => {
    if (!newInvite.email.trim()) {
      toast({
        title: "Email Required",
        description: "Please enter an email address",
        variant: "destructive",
      });
      return;
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    await userManagement.handleInviteUser(
      newInvite.email,
      newInvite.role,
      expiresAt.toISOString()
    );

    setNewInvite({ email: "", role: "employee" });
    setInviteDialogOpen(false);
    fetchMembers(); // Refresh the list
  };

  const handleChangeRole = async (userId: string, newRole: UserRole) => {
    await userManagement.handleChangeOrgRole(userId, newRole);
    fetchMembers(); // Refresh the list
  };

  const handleRemoveUser = async (userId: string) => {
    await userManagement.handleRemoveUserFromOrg(userId);
    fetchMembers(); // Refresh the list
  };

  const handleTransferOwnership = async () => {
    if (!transferTo) {
      toast({
        title: "User Required",
        description: "Please select a user to transfer ownership to",
        variant: "destructive",
      });
      return;
    }

    await userManagement.handleTransferOrgOwnership(transferTo);
    setTransferDialogOpen(false);
    setTransferTo("");
    fetchMembers(); // Refresh the list
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'owner':
        return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'admin':
        return <Shield className="w-4 h-4 text-purple-500" />;
      case 'supervisor':
        return <UserCheck className="w-4 h-4 text-blue-500" />;
      case 'employee':
        return <Users className="w-4 h-4 text-gray-500" />;
      default:
        return <Users className="w-4 h-4 text-gray-500" />;
    }
  };

  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case 'owner':
        return 'default';
      case 'admin':
        return 'secondary';
      case 'supervisor':
        return 'outline';
      case 'employee':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const canManageUser = (targetRole: UserRole) => {
    const hierarchy = { owner: 4, admin: 3, supervisor: 2, employee: 1 };
    const userLevel = hierarchy[currentUserRole];
    const targetLevel = hierarchy[targetRole];
    return userLevel >= targetLevel;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            User Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="w-full h-10 bg-muted rounded"></div>
            <div className="w-full h-8 bg-muted rounded"></div>
            <div className="w-full h-8 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              User Management
            </div>
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Invite User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite New User</DialogTitle>
                  <DialogDescription>
                    Send an invitation to join the organization
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="user@example.com"
                      value={newInvite.email}
                      onChange={(e) => setNewInvite(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="role">Role</Label>
                    <Select 
                      value={newInvite.role} 
                      onValueChange={(value: UserRole) => setNewInvite(prev => ({ ...prev, role: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {(['employee', 'supervisor', 'admin', 'owner'] as UserRole[])
                          .filter(role => canManageUser(role))
                          .map(role => (
                            <SelectItem key={role} value={role}>
                              {role.charAt(0).toUpperCase() + role.slice(1)}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button onClick={handleInviteUser} className="flex-1">
                      Send Invitation
                    </Button>
                    <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-3">
            {members.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No members found</p>
              </div>
            ) : (
              members.map((member) => (
                <div key={member.user_id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={member.users.avatar_url || undefined} />
                      <AvatarFallback>
                        {member.users.full_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{member.users.full_name || 'Unknown'}</span>
                        <div className="flex items-center gap-1">
                          {getRoleIcon(member.role)}
                          <Badge variant={getRoleBadgeVariant(member.role)}>
                            {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Mail className="w-3 h-3" />
                        {member.users.email}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {canManageUser(member.role) && member.user_id !== currentUserId && (
                      <>
                        <Select
                          value={member.role}
                          onValueChange={(value: UserRole) => handleChangeRole(member.user_id, value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(['employee', 'supervisor', 'admin', 'owner'] as UserRole[])
                              .filter(role => canManageUser(role))
                              .map(role => (
                                <SelectItem key={role} value={role}>
                                  {role.charAt(0).toUpperCase() + role.slice(1)}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <UserMinus className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove User</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to remove {member.users.full_name} from the organization? 
                                This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleRemoveUser(member.user_id)}>
                                Remove User
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </>
                    )}
                    
                    {currentUserRole === 'owner' && member.user_id !== currentUserId && (
                      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Crown className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Transfer Ownership</DialogTitle>
                            <DialogDescription>
                              Transfer organization ownership to {member.users.full_name}. 
                              You will become an admin after the transfer.
                            </DialogDescription>
                          </DialogHeader>
                          
                          <div className="space-y-4">
                            <div>
                              <Label>New Owner</Label>
                              <div className="p-3 border rounded-lg bg-muted/50">
                                <div className="flex items-center gap-2">
                                  <Avatar className="w-6 h-6">
                                    <AvatarImage src={member.users.avatar_url || undefined} />
                                    <AvatarFallback>
                                      {member.users.full_name?.charAt(0) || 'U'}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="font-medium">{member.users.full_name}</span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex gap-2">
                              <Button 
                                onClick={() => {
                                  setTransferTo(member.user_id);
                                  handleTransferOwnership();
                                }} 
                                className="flex-1"
                                variant="destructive"
                              >
                                Transfer Ownership
                              </Button>
                              <Button variant="outline" onClick={() => setTransferDialogOpen(false)}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
