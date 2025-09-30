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
  Key,
  Mail
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface JoinTeamCardProps {
  onTeamJoined: (org: any) => void;
  className?: string;
  isNewUser?: boolean;
}

export function JoinTeamCard({ 
  onTeamJoined, 
  className = "",
  isNewUser = false
}: JoinTeamCardProps) {
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
          last_selected: true, // Set as selected for new users
        });

      if (joinError) throw joinError;

      // Update the invitation status
      await supabase
        .from("org_invites")
        .update({ status: "accepted" })
        .eq("id", invite.id);

      const successMessage = isNewUser 
        ? `Welcome! You've joined ${invite.organization.name}`
        : `You've joined the team at ${invite.organization.name}`;

      toast({
        title: isNewUser ? "Welcome to the Team!" : "Successfully Joined Team!",
        description: successMessage,
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
      console.error("Error joining team:", error);
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
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
            <UserPlus className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">
              {isNewUser ? "Join Your Team" : "Join Team"}
            </CardTitle>
            <CardDescription>
              {isNewUser 
                ? "Enter your invitation code to join your organization team"
                : "Enter an invitation code to join a team in another organization"
              }
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="invite-code" className="text-sm font-medium flex items-center gap-2">
            <Key className="w-4 h-4" />
            Invitation Code
          </Label>
          <div className="flex gap-2">
            <Input
              id="invite-code"
              placeholder="Enter invitation code..."
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="flex-1"
              disabled={loading}
            />
            <Button 
              onClick={handleJoinWithCode}
              disabled={loading || !inviteCode.trim()}
              size="sm"
              className="px-4"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  {isNewUser ? "Join Team" : "Join"}
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Building2 className="w-3 h-3" />
          <span>
            {isNewUser 
              ? "You need a valid invitation code to join your team"
              : "You need a valid invitation code to join a team"
            }
          </span>
        </div>

        {isNewUser && (
          <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3">
            <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200 mb-2">
              <Mail className="w-4 h-4" />
              <span className="font-medium">New to the platform?</span>
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-300">
              Check your email for an invitation code from your organization. 
              If you don't have one, contact your team leader or HR department.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="w-3 h-3" />
            <span>Valid codes accepted</span>
          </div>
          <div className="flex items-center gap-2 text-red-600">
            <XCircle className="w-3 h-3" />
            <span>Expired codes rejected</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
