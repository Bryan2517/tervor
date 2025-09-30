import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/enhanced-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users, Crown, Shield, Eye, User } from "lucide-react";

type UserRole = "owner" | "admin" | "supervisor" | "employee";

interface OnlineUser {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  role: UserRole;
  status: "online" | "away" | "offline";
  current_task_id?: string;
  current_task_title?: string;
}

interface OnlinePresenceProps {
  organizationId: string;
}

const roleIcons = {
  owner: Crown,
  admin: Shield, 
  supervisor: Eye,
  employee: User,
};

const roleColors = {
  owner: "bg-gradient-to-r from-yellow-400 to-orange-500",
  admin: "bg-gradient-to-r from-purple-400 to-pink-500",
  supervisor: "bg-gradient-to-r from-blue-400 to-cyan-500",
  employee: "bg-gradient-to-r from-green-400 to-emerald-500",
};

const statusColors = {
  online: "bg-success",
  away: "bg-warning", 
  offline: "bg-muted-foreground",
};

export function OnlinePresence({ organizationId }: OnlinePresenceProps) {
  const [onlineUsers, setOnlineUsers] = useState<Record<UserRole, OnlineUser[]>>({
    owner: [],
    admin: [],
    supervisor: [],
    employee: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOnlineUsers();
    
    // Set up real-time subscription for presence updates
    const channel = supabase
      .channel('presence-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_presence'
        },
        () => {
          fetchOnlineUsers();
        }
      )
      .subscribe();

    // Update our own presence
    updatePresence();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId]);

  const fetchOnlineUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('organization_members')
        .select(`
          role,
          user_id,
          users!inner(
            id,
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('organization_id', organizationId)
        .order('role', { ascending: false });

      if (error) throw error;

      // Fetch user presence and tasks separately
      const userIds = data?.map(m => m.user_id) || [];
      
      const [presenceData, tasksData] = await Promise.all([
        supabase
          .from('user_presence')
          .select('user_id, status, current_task_id, updated_at')
          .in('user_id', userIds),
        supabase
          .from('tasks')
          .select('id, title')
          .in('id', data?.flatMap(m => []).filter(Boolean) || [])
      ]);


      const usersByRole: Record<UserRole, OnlineUser[]> = {
        owner: [],
        admin: [],
        supervisor: [],
        employee: [],
      };

      // Create maps for quick lookup
      const presenceMap = new Map(presenceData.data?.map(p => [p.user_id, p]) || []);
      const tasksMap = new Map(tasksData.data?.map(t => [t.id, t]) || []);

      data?.forEach((member: any) => {
        const user = member.users;
        const presence = presenceMap.get(member.user_id);
        const currentTask = presence?.current_task_id ? tasksMap.get(presence.current_task_id) : null;
        
        // Consider user offline if no presence update in last 5 minutes
        const isRecent = presence?.updated_at && 
          (Date.now() - new Date(presence.updated_at).getTime()) < 5 * 60 * 1000;
        
        const onlineUser: OnlineUser = {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          avatar_url: user.avatar_url,
          role: member.role,
          status: isRecent && presence?.status ? (presence.status as "online" | "away" | "offline") : 'offline',
          current_task_id: presence?.current_task_id,
          current_task_title: currentTask?.title,
        };

        usersByRole[member.role as UserRole].push(onlineUser);
      });

      setOnlineUsers(usersByRole);
    } catch (error) {
      console.error('Error fetching online users:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePresence = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      await supabase
        .from('user_presence')
        .upsert({
          user_id: user.user.id,
          status: 'online',
          updated_at: new Date().toISOString(),
        });
    } catch (error) {
      console.error('Error updating presence:', error);
    }
  };

  const getTotalOnline = () => {
    return Object.values(onlineUsers).flat().filter(user => user.status === 'online').length;
  };

  const getTotalMembers = () => {
    return Object.values(onlineUsers).flat().length;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Team Presence
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-muted rounded-full"></div>
                <div className="flex-1">
                  <div className="w-24 h-4 bg-muted rounded"></div>
                  <div className="w-32 h-3 bg-muted rounded mt-1"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Team Presence
          </div>
          <Badge variant="outline" className="text-xs">
            {getTotalOnline()}/{getTotalMembers()} online
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {(Object.keys(onlineUsers) as UserRole[]).map((role) => {
          const users = onlineUsers[role];
          if (users.length === 0) return null;

          const RoleIcon = roleIcons[role];
          
          return (
            <div key={role}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-4 h-4 rounded-full ${roleColors[role]} flex items-center justify-center`}>
                  <RoleIcon className="w-2.5 h-2.5 text-white" />
                </div>
                <span className="text-sm font-medium capitalize">{role}s</span>
                <span className="text-xs text-muted-foreground">
                  ({users.filter(u => u.status === 'online').length})
                </span>
              </div>
              
              <div className="space-y-2 ml-6">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {user.full_name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${statusColors[user.status]}`}></div>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{user.full_name}</p>
                      {user.current_task_title ? (
                        <p className="text-xs text-muted-foreground truncate">
                          Working on: {user.current_task_title}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {user.status === 'online' ? 'Available' : 
                           user.status === 'away' ? 'Away' : 'Offline'}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}