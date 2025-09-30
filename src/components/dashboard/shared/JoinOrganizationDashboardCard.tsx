import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/enhanced-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/enhanced-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  Plus, 
  Users, 
  CheckCircle2,
  XCircle,
  UserPlus,
  Key
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface JoinTeamDashboardCardProps {
  onTeamJoined: (org: any) => void;
  className?: string;
}

export function JoinOrganizationDashboardCard({ 
  onOrganizationJoined: onTeamJoined, 
  className = "" 
}: JoinTeamDashboardCardProps) {
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleJoinWithCode = async () => {
    if (!inviteCode.trim()) {
      toast({
        title: "Invalid Code",
        description: "Please enter a valid invitation code",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      // Look for the invitation by code
      const { data: invite, error: inviteError } = await supabase
        .from("org_invites")
        .select(`
          id,
          organization_id,
          role,
          status,
          organization:organizations(
            id,
            name,
            description,
            logo_url
          )
        `)
        .eq("invite_code", inviteCode.trim())
        .eq("status", "pending")
        .single();

      if (inviteError || !invite) {
        throw new Error("Invalid or expired invitation code");
      }

      // Check if user is already a member of this organization
      const { data: existingMember } = await supabase
        .from("organization_members")
        .select("id")
        .eq("user_id", user.user.id)
        .eq("organization_id", invite.organization_id)
        .single();

      if (existingMember) {
        throw new Error("You are already a member of this organization");
      }

      // Join the organization
      const { error: joinError } = await supabase
        .from("organization_members")
        .insert({
          user_id: user.user.id,
          organization_id: invite.organization_id,
          role: invite.role,
          last_selected: false,
        });

      if (joinError) throw joinError;

      // Update the invitation status
      await supabase
        .from("org_invites")
        .update({ status: "accepted" })
        .eq("id", invite.id);

      toast({
        title: "Successfully Joined Team!",
        description: `You've joined the team at ${invite.organization.name}`,
      });

      // Call the callback with organization info
      onTeamJoined({
        id: invite.organization.id,
        name: invite.organization.name,
        description: invite.organization.description,
        logo_url: invite.organization.logo_url,
        role: invite.role,
      });

      // Clear the input
      setInviteCode("");
    } catch (error: any) {
      console.error("Error joining organization:", error);
      toast({
        title: "Failed to Join Team",
        description: error.message || "Failed to join team",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card variant="interactive" className={className}>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
            <UserPlus className="w-6 h-6 text-white" />
          </div>
          <div>
            <CardTitle className="text-xl">Join Team</CardTitle>
            <CardDescription className="text-base">
              Enter an invitation code to join a team in another organization
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label htmlFor="invite-code" className="text-sm font-medium flex items-center gap-2">
            <Key className="w-4 h-4" />
            Invitation Code
          </Label>
          <div className="flex gap-3">
            <Input
              id="invite-code"
              placeholder="Enter invitation code (e.g., ABC123)"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="flex-1 text-base"
              disabled={loading}
            />
            <Button 
              onClick={handleJoinWithCode}
              disabled={loading || !inviteCode.trim()}
              size="lg"
              className="px-6"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  <Plus className="w-5 h-5 mr-2" />
                  Join
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="w-4 h-4" />
            <span>How to get a team invitation code:</span>
          </div>
          <ul className="text-sm text-muted-foreground space-y-1 ml-6">
            <li>• Ask a team member for their invitation code</li>
            <li>• Check your email for team invitations</li>
            <li>• Contact the team leader or organization admin</li>
          </ul>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-200">Valid Code</p>
              <p className="text-xs text-green-600 dark:text-green-300">Code accepted, joining organization</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
            <XCircle className="w-5 h-5 text-red-600" />
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-200">Invalid Code</p>
              <p className="text-xs text-red-600 dark:text-red-300">Code expired or doesn't exist</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
