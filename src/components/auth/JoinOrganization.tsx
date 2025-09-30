import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/enhanced-card";
import { Button } from "@/components/ui/enhanced-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Loader2 } from "lucide-react";

interface JoinOrganizationProps {
  onJoinSuccess: () => void;
}

export function JoinOrganization({ onJoinSuccess }: JoinOrganizationProps) {
  const [inviteCode, setInviteCode] = useState("");
  const [joining, setJoining] = useState(false);
  const { toast } = useToast();

  const handleJoinOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inviteCode.trim()) {
      toast({
        title: "Invalid Code",
        description: "Please enter a valid invitation code",
        variant: "destructive",
      });
      return;
    }

    setJoining(true);
    try {
      const { data, error } = await supabase.rpc('claim_org_invite', {
        p_code: inviteCode.trim()
      });

      if (error) {
        if (error.message.includes('Invalid invite code')) {
          toast({
            title: "Invalid Code",
            description: "The invitation code you entered is not valid",
            variant: "destructive",
          });
        } else if (error.message.includes('Invite already used')) {
          toast({
            title: "Code Already Used",
            description: "This invitation code has already been used",
            variant: "destructive",
          });
        } else if (error.message.includes('Invite expired')) {
          toast({
            title: "Code Expired",
            description: "This invitation code has expired",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: error.message || "Failed to join organization",
            variant: "destructive",
          });
        }
        return;
      }

      if (data && data.length > 0) {
        toast({
          title: "Welcome to the team!",
          description: `You've successfully joined the organization as ${data[0].role}`,
        });
        onJoinSuccess();
      }
    } catch (error: any) {
      console.error('Error joining organization:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setJoining(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <UserPlus className="w-5 h-5" />
          Join Organization
        </CardTitle>
        <CardDescription>
          Enter an invitation code to join an organization
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleJoinOrganization} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="inviteCode">Invitation Code</Label>
            <Input
              id="inviteCode"
              type="text"
              placeholder="Enter invitation code"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="font-mono"
              required
            />
            <p className="text-xs text-muted-foreground">
              Ask your team admin for an invitation code
            </p>
          </div>
          
          <Button
            type="submit"
            className="w-full"
            disabled={joining || !inviteCode.trim()}
          >
            {joining ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Joining...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-2" />
                Join Organization
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}