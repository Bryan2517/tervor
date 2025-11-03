import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ArrowLeft, Gift, Award } from "lucide-react";
import { useOrganization } from "@/contexts/OrganizationContext";
import { format } from "date-fns";

interface Redemption {
  id: string;
  created_at: string;
  approved_at: string | null;
  points_spent: number;
  code: string | null;
  used_at: string | null;
  reward: {
    id: string;
    title: string;
    description: string | null;
  };
}

export function MyRewards() {
  const navigate = useNavigate();
  const { organization } = useOrganization();
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingRewardId, setConfirmingRewardId] = useState<string | null>(null);

  const getShopPath = () => {
    if (organization?.role === "supervisor") return "/supervisor/shop";
    return "/employee/shop";
  };

  useEffect(() => {
    if (organization) {
      fetchRedemptions();
    }
  }, [organization]);

  const fetchRedemptions = async () => {
    if (!organization) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("redemptions")
        .select(`
          *,
          reward:rewards(id, title, description)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRedemptions(data as any || []);
    } catch (error) {
      console.error("Error fetching redemptions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUseReward = async (redemptionId: string) => {
    try {
      const { error } = await supabase
        .from("redemptions")
        .update({ used_at: new Date().toISOString() })
        .eq("id", redemptionId);

      if (error) throw error;

      // Update local state
      setRedemptions(redemptions.map(r => 
        r.id === redemptionId ? { ...r, used_at: new Date().toISOString() } : r
      ));
      
      // Close confirmation dialog
      setConfirmingRewardId(null);
    } catch (error) {
      console.error("Error marking reward as used:", error);
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
              <h1 className="text-xl font-semibold">My Rewards</h1>
              <p className="text-sm text-muted-foreground">View your redemption history</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5" />
              My Reward History
            </CardTitle>
            <CardDescription>
              {redemptions.length} reward{redemptions.length !== 1 ? 's' : ''} redeemed
            </CardDescription>
          </CardHeader>
          <CardContent>
            {redemptions.length === 0 ? (
              <div className="text-center py-12">
                <Gift className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground font-medium mb-2">No rewards yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  You haven't redeemed any rewards yet
                </p>
                <Button onClick={() => navigate(getShopPath())}>
                  <Gift className="w-4 h-4 mr-2" />
                  Browse Rewards
                </Button>
              </div>
            ) : (
              <div className="grid gap-4">
                {redemptions.map((redemption) => (
                  <Card key={redemption.id} variant="interactive">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                              <Gift className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-lg">{redemption.reward.title}</h3>
                              <p className="text-sm text-muted-foreground">
                                Redeemed on {format(new Date(redemption.created_at), "MMM d, yyyy")}
                              </p>
                            </div>
                          </div>
                          
                          {redemption.reward.description && (
                            <p className="text-sm text-muted-foreground mb-3">
                              {redemption.reward.description}
                            </p>
                          )}

                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-2">
                              <Award className="w-4 h-4 text-primary" />
                              <span className="font-medium">{redemption.points_spent} points</span>
                            </div>
                          </div>

                          {redemption.code && (
                            <div className="mt-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
                              <p className="text-xs font-medium text-primary mb-1">Redemption Code</p>
                              <p className="text-2xl font-bold font-mono">{redemption.code}</p>
                            </div>
                          )}
                        </div>
                        <Button
                          variant={redemption.used_at ? "outline" : "default"}
                          disabled={!!redemption.used_at}
                          onClick={() => setConfirmingRewardId(redemption.id)}
                        >
                          {redemption.used_at ? "Used" : "Use"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={confirmingRewardId !== null} onOpenChange={(open) => !open && setConfirmingRewardId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Use Reward?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to use this reward? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => confirmingRewardId && handleUseReward(confirmingRewardId)}>
                Yes, Use It
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
