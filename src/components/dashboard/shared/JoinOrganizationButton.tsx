import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/enhanced-button";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/enhanced-card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Building2, 
  Plus, 
  Search, 
  Users, 
  Crown, 
  Shield, 
  Eye, 
  User,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type UserRole = "owner" | "admin" | "supervisor" | "employee";

interface Organization {
  id: string;
  name: string;
  description?: string;
  logo_url?: string;
  created_at: string;
  member_count?: number;
}

interface JoinOrganizationButtonProps {
  onOrganizationJoined: (org: Organization) => void;
  className?: string;
}

const roleIcons = {
  owner: Crown,
  admin: Shield,
  supervisor: Eye,
  employee: User,
};

export function JoinOrganizationButton({ 
  onOrganizationJoined, 
  className = "" 
}: JoinOrganizationButtonProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState<string | null>(null);
  const { toast } = useToast();

  const handleOpenDialog = async () => {
    setOpen(true);
    await fetchAvailableOrganizations();
  };

  const fetchAvailableOrganizations = async () => {
    setLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      // Get organizations the user is already a member of
      const { data: userMemberships } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.user.id);

      const userOrgIds = userMemberships?.map(m => m.organization_id) || [];

      // Get all public organizations that the user is not a member of
      const { data, error } = await supabase
        .from("organizations")
        .select(`
          id,
          name,
          description,
          logo_url,
          created_at,
          organization_members(count)
        `)
        .not("id", "in", `(${userOrgIds.join(",")})`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const orgs = data?.map(org => ({
        ...org,
        member_count: org.organization_members?.[0]?.count || 0,
      })) as Organization[];

      setOrganizations(orgs || []);
    } catch (error) {
      console.error("Error fetching organizations:", error);
      toast({
        title: "Error",
        description: "Failed to load organizations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleJoinOrganization = async (org: Organization) => {
    setJoining(org.id);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      // Check if organization has open invitations or if it's public
      const { data: invite } = await supabase
        .from("org_invites")
        .select("id, role")
        .eq("organization_id", org.id)
        .eq("email", user.user.email)
        .eq("status", "pending")
        .single();

      if (invite) {
        // User has a pending invitation, accept it
        const { error: acceptError } = await supabase
          .from("organization_members")
          .insert({
            user_id: user.user.id,
            organization_id: org.id,
            role: invite.role,
            last_selected: false,
          });

        if (acceptError) throw acceptError;

        // Update the invitation status
        await supabase
          .from("org_invites")
          .update({ status: "accepted" })
          .eq("id", invite.id);

        toast({
          title: "Invitation Accepted",
          description: `You've joined ${org.name}`,
        });
      } else {
        // Request to join (for private organizations)
        const { error: requestError } = await supabase
          .from("org_invites")
          .insert({
            organization_id: org.id,
            email: user.user.email,
            role: "employee",
            status: "pending",
            invited_by: user.user.id,
          });

        if (requestError) throw requestError;

        toast({
          title: "Join Request Sent",
          description: `Request sent to join ${org.name}. You'll be notified when approved.`,
        });
      }

      onOrganizationJoined(org);
      setOpen(false);
    } catch (error) {
      console.error("Error joining organization:", error);
      toast({
        title: "Error",
        description: "Failed to join organization",
        variant: "destructive",
      });
    } finally {
      setJoining(null);
    }
  };

  const filteredOrganizations = organizations.filter(org =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleOpenDialog}
          className={className}
        >
          <Plus className="w-4 h-4 mr-2" />
          Join Organization
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Join Organization
          </DialogTitle>
          <DialogDescription>
            Discover and join organizations to expand your network
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search organizations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Organizations List */}
          <div className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredOrganizations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No organizations found</p>
                <p className="text-sm">Try adjusting your search terms</p>
              </div>
            ) : (
              filteredOrganizations.map((org) => (
                <Card key={org.id} variant="interactive" className="p-4">
                  <CardContent className="p-0">
                    <div className="flex items-center gap-4">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={org.logo_url || undefined} />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {org.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-lg truncate">
                            {org.name}
                          </h3>
                          <Badge variant="secondary" className="text-xs">
                            <Users className="w-3 h-3 mr-1" />
                            {org.member_count} members
                          </Badge>
                        </div>
                        
                        {org.description && (
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                            {org.description}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Created {new Date(org.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleJoinOrganization(org)}
                          disabled={joining === org.id}
                          className="flex items-center gap-2"
                        >
                          {joining === org.id ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              Joining...
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4" />
                              Join
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
