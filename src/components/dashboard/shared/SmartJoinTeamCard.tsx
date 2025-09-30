import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { JoinTeamDashboardCard } from "./JoinTeamDashboardCard";

interface SmartJoinTeamCardProps {
  onTeamJoined: (org: any) => void;
  className?: string;
}

export function SmartJoinTeamCard({ 
  onTeamJoined, 
  className = "" 
}: SmartJoinTeamCardProps) {
  const [isNewUser, setIsNewUser] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkIfNewUser();
  }, []);

  const checkIfNewUser = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      // Check if user has any organization memberships
      const { data: memberships } = await supabase
        .from("organization_members")
        .select("id")
        .eq("user_id", user.user.id);

      // If no memberships, user is new
      setIsNewUser(memberships?.length === 0);
    } catch (error) {
      console.error("Error checking user status:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-48 bg-muted rounded-lg"></div>
      </div>
    );
  }

  return (
    <JoinTeamDashboardCard 
      onTeamJoined={onTeamJoined}
      isNewUser={isNewUser}
      className={className}
    />
  );
}
