import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ShoppingCart, Gift, Award } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

interface Reward {
  id: string;
  title: string;
  description: string | null;
  points_cost: number;
  stock: number | null;
  active: boolean;
}

export function Shop() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [userPoints, setUserPoints] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  useEffect(() => {
    fetchShopData();
  }, []);

  const fetchShopData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get organization
      const { data: memberData } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .single();

      if (!memberData) return;
      setOrganizationId(memberData.organization_id);

      // Fetch rewards
      const { data: rewardsData, error: rewardsError } = await supabase
        .from("rewards")
        .select("*")
        .eq("organization_id", memberData.organization_id)
        .eq("active", true)
        .order("points_cost");

      if (rewardsError) throw rewardsError;
      setRewards(rewardsData || []);

      // Fetch user points
      const { data: pointsData, error: pointsError } = await supabase
        .from("points_ledger")
        .select("balance_after")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pointsError) throw pointsError;
      setUserPoints(pointsData?.balance_after || 0);
    } catch (error) {
      console.error("Error fetching shop data:", error);
      toast({
        title: "Error",
        description: "Failed to load shop",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async (reward: Reward) => {
    if (userPoints < reward.points_cost) {
      toast({
        title: "Insufficient Points",
        description: "You don't have enough points for this reward",
        variant: "destructive",
      });
      return;
    }

    if (reward.stock !== null && reward.stock <= 0) {
      toast({
        title: "Out of Stock",
        description: "This reward is currently unavailable",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Create redemption
      const { error: redemptionError } = await supabase
        .from("redemptions")
        .insert({
          user_id: user.id,
          reward_id: reward.id,
          points_spent: reward.points_cost,
          status: "pending",
        });

      if (redemptionError) throw redemptionError;

      // Update stock if applicable
      if (reward.stock !== null) {
        const { error: stockError } = await supabase
          .from("rewards")
          .update({ stock: reward.stock - 1 })
          .eq("id", reward.id);

        if (stockError) throw stockError;
      }

      toast({
        title: "Success",
        description: "Redemption request submitted! An admin will process it soon.",
      });

      fetchShopData();
    } catch (error) {
      console.error("Error redeeming reward:", error);
      toast({
        title: "Error",
        description: "Failed to redeem reward",
        variant: "destructive",
      });
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold">Rewards Shop</h1>
                <p className="text-sm text-muted-foreground">Redeem your points for rewards</p>
              </div>
            </div>
            <Card className="border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm text-muted-foreground">Your Points</p>
                    <p className="text-2xl font-bold">{userPoints}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {rewards.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Gift className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No rewards available</p>
              <p className="text-sm text-muted-foreground">Check back later for new rewards!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rewards.map((reward) => {
              const canAfford = userPoints >= reward.points_cost;
              const inStock = reward.stock === null || reward.stock > 0;
              const canRedeem = canAfford && inStock;

              return (
                <Card key={reward.id} className={!canRedeem ? "opacity-60" : ""}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <Gift className="w-8 h-8 text-primary" />
                      <Badge variant={canAfford ? "default" : "secondary"}>
                        {reward.points_cost} pts
                      </Badge>
                    </div>
                    <CardTitle className="mt-4">{reward.title}</CardTitle>
                    {reward.description && (
                      <CardDescription>{reward.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {reward.stock !== null && (
                        <p className="text-sm text-muted-foreground">
                          Stock: {reward.stock} remaining
                        </p>
                      )}
                      <Button
                        onClick={() => handleRedeem(reward)}
                        disabled={!canRedeem}
                        className="w-full"
                      >
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        {!canAfford ? "Insufficient Points" : !inStock ? "Out of Stock" : "Redeem"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
