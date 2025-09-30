import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/enhanced-card";
import { Button } from "@/components/ui/enhanced-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, CheckCircle2, XCircle, Loader2 } from "lucide-react";

type UserRole = "owner" | "admin" | "supervisor" | "employee";

interface InviteData {
  id: string;
  organization_id: string;
  role: UserRole;
  email?: string;
  expires_at: string;
  used_at?: string;
  organization: {
    name: string;
    description?: string;
    logo_url?: string;
  };
}

export function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuthAndFetchInvite();
  }, [code]);

  const checkAuthAndFetchInvite = async () => {
    try {
      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);

      if (!code) {
        setError("Invalid invitation link");
        return;
      }

      // Fetch invite data
      const { data, error } = await supabase
        .from('org_invites')
        .select(`
          *,
          organization:organizations(name, description, logo_url)
        `)
        .eq('code', code)
        .single();

      if (error) {
        setError("Invitation not found");
        return;
      }

      if (data.used_at) {
        setError("This invitation has already been used");
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        setError("This invitation has expired");
        return;
      }

      setInviteData(data);
    } catch (error) {
      console.error('Error fetching invite:', error);
      setError("Failed to load invitation");
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvite = async () => {
    if (!inviteData || !isAuthenticated) return;
    
    setAccepting(true);
    try {
      const { data, error } = await supabase.rpc('claim_org_invite', {
        p_code: code
      });

      if (error) throw error;

      toast({
        title: "Welcome to the team!",
        description: `You've joined ${inviteData.organization.name} as ${inviteData.role}`,
      });

      // Redirect to the main dashboard
      navigate('/');
    } catch (error: any) {
      console.error('Error accepting invite:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to accept invitation",
        variant: "destructive",
      });
    } finally {
      setAccepting(false);
    }
  };

  const handleLogin = () => {
    // Store the invite code in localStorage to handle after login
    localStorage.setItem('pending_invite', code || '');
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading invitation...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">Invalid Invitation</h1>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => navigate('/')} variant="outline">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!inviteData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Avatar className="w-16 h-16">
              <AvatarImage src={inviteData.organization.logo_url || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                {inviteData.organization.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
          <CardTitle className="flex items-center justify-center gap-2">
            <UserPlus className="w-5 h-5" />
            You're Invited!
          </CardTitle>
          <CardDescription>
            Join <strong>{inviteData.organization.name}</strong> as {inviteData.role}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {inviteData.organization.description && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                {inviteData.organization.description}
              </p>
            </div>
          )}
          
          <div className="flex items-center justify-center gap-2">
            <span className="text-sm text-muted-foreground">Role:</span>
            <Badge variant="outline" className="capitalize">
              {inviteData.role}
            </Badge>
          </div>

          {inviteData.email && (
            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                This invitation is specifically for: <strong>{inviteData.email}</strong>
              </p>
            </div>
          )}

          <div className="pt-4">
            {isAuthenticated ? (
              <Button 
                onClick={handleAcceptInvite} 
                disabled={accepting}
                className="w-full"
              >
                {accepting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Joining...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Accept Invitation
                  </>
                )}
              </Button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-center text-muted-foreground">
                  You need to be signed in to accept this invitation
                </p>
                <Button onClick={handleLogin} className="w-full">
                  Sign In to Accept
                </Button>
              </div>
            )}
          </div>
          
          <div className="text-center pt-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              Go to Home
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}