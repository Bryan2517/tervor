import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Gift, Plus, Coins } from "lucide-react";
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

export function ShopManagement() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const [newReward, setNewReward] = useState({
    title: "",
    description: "",
    points_cost: 0,
    stock: 0,
  });

  useEffect(() => {
    fetchRewards();
  }, []);

  const fetchRewards = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: memberData } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .single();

      if (!memberData) return;

      setOrganizationId(memberData.organization_id);

      const { data, error } = await supabase
        .from("rewards")
        .select("*")
        .eq("organization_id", memberData.organization_id)
        .order("points_cost");

      if (error) throw error;
      setRewards(data || []);
    } catch (error) {
      console.error("Error fetching rewards:", error);
      toast({
        title: "Error",
        description: "Failed to load rewards",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReward = async () => {
    if (!organizationId || !newReward.title || newReward.points_cost <= 0) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("rewards").insert({
        organization_id: organizationId,
        title: newReward.title,
        description: newReward.description || null,
        points_cost: newReward.points_cost,
        stock: newReward.stock > 0 ? newReward.stock : null,
        active: true,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Reward created successfully",
      });

      setNewReward({ title: "", description: "", points_cost: 0, stock: 0 });
      setIsDialogOpen(false);
      fetchRewards();
    } catch (error) {
      console.error("Error creating reward:", error);
      toast({
        title: "Error",
        description: "Failed to create reward",
        variant: "destructive",
      });
    }
  };

  const handleToggleActive = async (rewardId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("rewards")
        .update({ active: !currentStatus })
        .eq("id", rewardId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Reward ${!currentStatus ? "activated" : "deactivated"}`,
      });

      fetchRewards();
    } catch (error) {
      console.error("Error toggling reward status:", error);
      toast({
        title: "Error",
        description: "Failed to update reward status",
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
                <h1 className="text-2xl font-bold">Shop Management</h1>
                <p className="text-sm text-muted-foreground">Manage rewards and gifts</p>
              </div>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  New Reward
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Reward</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={newReward.title}
                      onChange={(e) => setNewReward({ ...newReward, title: e.target.value })}
                      placeholder="e.g., Amazon Gift Card"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={newReward.description}
                      onChange={(e) => setNewReward({ ...newReward, description: e.target.value })}
                      placeholder="Optional description"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="points">Points Cost</Label>
                    <Input
                      id="points"
                      type="number"
                      value={newReward.points_cost}
                      onChange={(e) => setNewReward({ ...newReward, points_cost: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="stock">Stock (leave 0 for unlimited)</Label>
                    <Input
                      id="stock"
                      type="number"
                      value={newReward.stock}
                      onChange={(e) => setNewReward({ ...newReward, stock: parseInt(e.target.value) })}
                    />
                  </div>
                  <Button onClick={handleCreateReward} className="w-full">
                    Create Reward
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {rewards.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Gift className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Rewards Yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Create your first reward to get started
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rewards.map((reward) => (
              <Card key={reward.id} className={!reward.active ? "opacity-60" : ""}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Gift className="w-5 h-5" />
                    {reward.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {reward.description && (
                    <p className="text-sm text-muted-foreground">{reward.description}</p>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <Coins className="w-5 h-5 text-warning" />
                    <span className="font-bold text-lg">{reward.points_cost}</span>
                    <span className="text-sm text-muted-foreground">points</span>
                  </div>

                  {reward.stock !== null && (
                    <p className="text-sm text-muted-foreground">
                      Stock: {reward.stock} remaining
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t">
                    <Label htmlFor={`active-${reward.id}`}>Active</Label>
                    <Switch
                      id={`active-${reward.id}`}
                      checked={reward.active}
                      onCheckedChange={() => handleToggleActive(reward.id, reward.active)}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
