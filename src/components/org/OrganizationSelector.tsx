import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/enhanced-card";
import { Button } from "@/components/ui/enhanced-button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Building, Users, Crown, ShieldCheck, UserCheck, UserIcon, Plus, Key } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type Organization = Tables<"my_organizations">;
type UserRole = "owner" | "admin" | "supervisor" | "employee";

interface OrganizationWithRole extends Organization {
  role: UserRole;
}

interface OrganizationSelectorProps {
  onOrganizationSelect: (org: OrganizationWithRole) => void;
}

const roleIcons = {
  owner: Crown,
  admin: ShieldCheck,
  manager: UserCheck,
  employee: UserIcon,
};

const roleColors = {
  owner: "bg-gradient-points",
  admin: "bg-primary",
  manager: "bg-accent",
  employee: "bg-secondary",
};

export function OrganizationSelector({ onOrganizationSelect }: OrganizationSelectorProps) {
  const [organizations, setOrganizations] = useState<OrganizationWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [orgDescription, setOrgDescription] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from("organization_members")
        .select(`
          role,
          organization:organizations(*)
        `)
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id);

      if (error) throw error;

      const orgsWithRoles = data
        ?.filter(item => item.organization)
        .map(item => ({
          ...item.organization,
          role: item.role,
        })) as OrganizationWithRole[];

      setOrganizations(orgsWithRoles || []);
    } catch (error) {
      console.error("Error fetching organizations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOrganization = async (org: OrganizationWithRole) => {
    // Update last_selected for this organization
    await supabase
      .from("organization_members")
      .update({ last_selected: false })
      .eq("user_id", (await supabase.auth.getUser()).data.user?.id);

    await supabase
      .from("organization_members")
      .update({ last_selected: true })
      .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
      .eq("organization_id", org.id);

    onOrganizationSelect(org);
  };

  const handleCreateOrganization = async () => {
    if (!orgName.trim()) {
      toast({
        title: "Error",
        description: "Organization name is required",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.rpc('create_org_with_owner', {
        p_name: orgName.trim(),
        p_description: orgDescription.trim() || null,
      });

      if (error) throw error;

      // Fetch the created organization to get full details
      const { data: newOrg, error: fetchError } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", data)
        .single();

      if (fetchError) throw fetchError;

      toast({
        title: "Success",
        description: "Organization created successfully!",
      });

      // Select the new organization
      onOrganizationSelect({
        ...newOrg,
        role: "owner" as UserRole,
      });

      setCreateDialogOpen(false);
      setOrgName("");
      setOrgDescription("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create organization",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleJoinOrganization = async () => {
    if (!inviteCode.trim()) {
      toast({
        title: "Error",
        description: "Invite code is required",
        variant: "destructive",
      });
      return;
    }

    setJoining(true);
    try {
      const { data, error } = await supabase.rpc('claim_org_invite', {
        p_code: inviteCode.trim(),
      });

      if (error) throw error;

      // Fetch the organization details
      const { data: org, error: fetchError } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", data[0].organization_id)
        .single();

      if (fetchError) throw fetchError;

      toast({
        title: "Success",
        description: "Successfully joined organization!",
      });

      // Select the organization
      onOrganizationSelect({
        ...org,
        role: data[0].role,
      });

      setJoinDialogOpen(false);
      setInviteCode("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to join organization",
        variant: "destructive",
      });
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card variant="elevated" className="w-full max-w-md text-center">
          <CardHeader>
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Building className="w-8 h-8 text-muted-foreground" />
            </div>
            <CardTitle>Welcome to TeamSpark</CardTitle>
            <CardDescription>
              Get started by creating your own organization or joining an existing one with an invite code.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="default" className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Organization
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Organization</DialogTitle>
                  <DialogDescription>
                    Create your own organization and become the owner.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="org-name">Organization Name</Label>
                    <Input
                      id="org-name"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="Enter organization name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="org-description">Description (Optional)</Label>
                    <Textarea
                      id="org-description"
                      value={orgDescription}
                      onChange={(e) => setOrgDescription(e.target.value)}
                      placeholder="Describe your organization"
                      rows={3}
                    />
                  </div>
                  <Button 
                    onClick={handleCreateOrganization} 
                    disabled={creating || !orgName.trim()}
                    className="w-full"
                  >
                    {creating ? "Creating..." : "Create Organization"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  <Key className="w-4 h-4 mr-2" />
                  Join with Invite Code
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Join Organization</DialogTitle>
                  <DialogDescription>
                    Enter the invite code provided by your organization admin.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="invite-code">Invite Code</Label>
                    <Input
                      id="invite-code"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      placeholder="Enter invite code"
                    />
                  </div>
                  <Button 
                    onClick={handleJoinOrganization} 
                    disabled={joining || !inviteCode.trim()}
                    className="w-full"
                  >
                    {joining ? "Joining..." : "Join Organization"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (organizations.length === 1) {
    // Auto-select if only one organization
    handleSelectOrganization(organizations[0]);
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Select Organization</h1>
          <p className="text-muted-foreground">Choose which organization you'd like to work with today</p>
        </div>

        <div className="grid gap-4">
          {organizations.map((org) => {
            const RoleIcon = roleIcons[org.role];
            
            return (
              <Card
                key={org.id}
                variant="interactive"
                className="cursor-pointer"
                onClick={() => handleSelectOrganization(org)}
              >
                <CardContent className="flex items-center gap-4 p-6">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={org.logo_url || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                      {org.name?.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-semibold">{org.name}</h3>
                      <Badge variant="secondary" className={cn("text-xs", roleColors[org.role])}>
                        <RoleIcon className="w-3 h-3 mr-1" />
                        {org.role}
                      </Badge>
                    </div>
                    {org.description && (
                      <p className="text-sm text-muted-foreground">{org.description}</p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span className="text-sm">Team</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}