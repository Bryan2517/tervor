import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/enhanced-card";
import { Button } from "@/components/ui/enhanced-button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, 
  Trophy, 
  Crown, 
  Star, 
  Medal,
  TrendingUp,
  Target,
  Zap,
  Coins
} from "lucide-react";

interface LeaderboardUser {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
  points: number;
  rank: number;
  tasks_completed: number;
  streak: number;
}

export function Leaderboard() {
  const [users, setUsers] = useState<LeaderboardUser[]>([]);
  const [currentUser, setCurrentUser] = useState<LeaderboardUser | null>(null);
  const [timeframe, setTimeframe] = useState<"weekly" | "monthly" | "allTime">("weekly");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, [timeframe]);

  const fetchLeaderboard = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // In a real app, you'd fetch this from your points_ledger and user tables
      // This is mock data for demonstration
      const mockLeaderboard: LeaderboardUser[] = [
        {
          id: "1",
          email: "alex@example.com",
          full_name: "Alex Johnson",
          points: 1250,
          rank: 1,
          tasks_completed: 45,
          streak: 12
        },
        {
          id: "2", 
          email: "sarah@example.com",
          full_name: "Sarah Chen",
          points: 1100,
          rank: 2,
          tasks_completed: 38,
          streak: 8
        },
        {
          id: user.id,
          email: user.email!,
          full_name: user.user_metadata?.full_name || "You",
          points: 950,
          rank: 3,
          tasks_completed: 32,
          streak: 5
        },
        {
          id: "4",
          email: "mike@example.com",
          full_name: "Mike Rodriguez",
          points: 800,
          rank: 4,
          tasks_completed: 28,
          streak: 3
        },
        {
          id: "5",
          email: "emma@example.com",
          full_name: "Emma Wilson",
          points: 650,
          rank: 5,
          tasks_completed: 25,
          streak: 6
        }
      ];

      setUsers(mockLeaderboard);
      setCurrentUser(mockLeaderboard.find(u => u.id === user.id) || null);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-yellow-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Medal className="w-5 h-5 text-orange-500" />;
      default:
        return <span className="text-sm font-semibold">#{rank}</span>;
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-yellow-50 border-yellow-200";
      case 2:
        return "bg-gray-50 border-gray-200";
      case 3:
        return "bg-orange-50 border-orange-200";
      default:
        return "bg-white";
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
            <Button variant="ghost" size="icon" asChild>
              <Link to="/employee">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-semibold">Leaderboard</h1>
              <p className="text-sm text-muted-foreground">See how you rank against your team</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Current User Stats */}
        {currentUser && (
          <Card className="mb-6 bg-gradient-to-r from-primary/10 to-blue-100 border-primary/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="w-16 h-16 border-2 border-primary">
                    <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                      {currentUser.full_name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-xl font-semibold">{currentUser.full_name}</h3>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-2">
                        <Trophy className="w-4 h-4 text-yellow-600" />
                        <span className="font-semibold">Rank #{currentUser.rank}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Coins className="w-4 h-4 text-yellow-600" />
                        <span className="font-semibold">{currentUser.points} points</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-orange-600" />
                        <span className="font-semibold">{currentUser.streak} day streak</span>
                      </div>
                    </div>
                  </div>
                </div>
                <Badge variant="default" className="text-lg px-4 py-2">
                  {getRankIcon(currentUser.rank)}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Timeframe Filter */}
        <div className="flex gap-2 mb-6 justify-center">
          {[
            { key: "weekly" as const, label: "This Week" },
            { key: "monthly" as const, label: "This Month" },
            { key: "allTime" as const, label: "All Time" },
          ].map(({ key, label }) => (
            <Button
              key={key}
              variant={timeframe === key ? "default" : "outline"}
              onClick={() => setTimeframe(key)}
            >
              {label}
            </Button>
          ))}
        </div>

        {/* Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Team Leaderboard - {timeframe === "weekly" ? "This Week" : timeframe === "monthly" ? "This Month" : "All Time"}
            </CardTitle>
            <CardDescription>
              Top performers based on points earned
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {users.map((user, index) => (
              <Card 
                key={user.id} 
                variant="interactive" 
                className={cn(
                  "transition-all duration-200",
                  getRankColor(user.rank),
                  user.id === currentUser?.id && "ring-2 ring-primary"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-8">
                        {getRankIcon(user.rank)}
                      </div>
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-muted text-muted-foreground">
                          {user.full_name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="font-semibold flex items-center gap-2">
                          {user.full_name}
                          {user.id === currentUser?.id && (
                            <Badge variant="secondary" className="text-xs">
                              You
                            </Badge>
                          )}
                        </h4>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Coins className="w-3 h-3" />
                            {user.points} pts
                          </span>
                          <span className="flex items-center gap-1">
                            <Target className="w-3 h-3" />
                            {user.tasks_completed} tasks
                          </span>
                          <span className="flex items-center gap-1">
                            <Zap className="w-3 h-3" />
                            {user.streak} day streak
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        <span className="font-semibold text-lg">{user.points}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">Total Points</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>

        {/* How to Earn Points */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="w-5 h-5" />
              How to Earn Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-semibold">Complete Tasks</p>
                  <p className="text-sm text-muted-foreground">+10 points per task</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                <Clock className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-semibold">On-time Delivery</p>
                  <p className="text-sm text-muted-foreground">+5 bonus points</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                <Zap className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="font-semibold">Daily Streak</p>
                  <p className="text-sm text-muted-foreground">+2 points per day</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
                <Target className="w-5 h-5 text-orange-600" />
                <div>
                  <p className="font-semibold">Urgent Tasks</p>
                  <p className="text-sm text-muted-foreground">+15 points</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}