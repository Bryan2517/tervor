import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/enhanced-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  Building2, 
  ChevronDown, 
  Crown, 
  Shield, 
  Eye, 
  User,
  LogOut,
  Plus
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { JoinTeamCard } from "./JoinTeamCard";

type UserRole = "owner" | "admin" | "supervisor" | "employee";

interface Organization {
  id: string;
  name: string;
  description?: string;
  logo_url?: string;
  role: UserRole;
  last_selected?: boolean;
  joined_at?: string;
}

interface SimpleOrgSwitchProps {
  currentOrganization: {
    id: string;
    name: string;
    description?: string;
    logo_url?: string;
    role: UserRole;
  };
  onOrganizationChange: (org: Organization) => void;
  onTeamJoined: (org: Organization) => void;
  onLogout: () => void;
  className?: string;
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

export function SimpleOrgSwitch({ 
  currentOrganization, 
  onOrganizationChange, 
  onTeamJoined,
  onLogout, 
  className = "" 
}: SimpleOrgSwitchProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data, error } = await supabase
        .from("organization_members")
        .select(`
          role,
          last_selected,
          created_at,
          organization:organizations(*)
        `)
        .eq("user_id", user.user.id)
        .order("last_selected", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      const orgs = data
        ?.filter(item => item.organization)
        .map(item => ({
          ...item.organization,
          role: item.role,
          last_selected: item.last_selected,
          joined_at: item.created_at,
        })) as Organization[];

      setOrganizations(orgs || []);
    } catch (error) {
      console.error("Error fetching organizations:", error);
    }
  };

  const handleSwitchOrganization = async (org: Organization) => {
    if (org.id === currentOrganization.id) return;

    setLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      // Try the RPC function first, fallback to manual update
      try {
        const { error } = await supabase.rpc('switch_organization' as any, {
          p_user_id: user.user.id,
          p_org_id: org.id
        });

        if (error) throw error;
      } catch (rpcError) {
        // Fallback to manual update if function doesn't exist
        console.log("switch_organization function not found, using fallback method");
        
        // Set all memberships to not selected
        await supabase
          .from("organization_members")
          .update({ last_selected: false })
          .eq("user_id", user.user.id);

        // Set the specified organization as selected
        const { error: updateError } = await supabase
          .from("organization_members")
          .update({ last_selected: true })
          .eq("user_id", user.user.id)
          .eq("organization_id", org.id);

        if (updateError) throw updateError;
      }

      onOrganizationChange(org);
      
      toast({
        title: "Organization Switched",
        description: `Now working with ${org.name}`,
      });
    } catch (error) {
      console.error("Error switching organization:", error);
      toast({
        title: "Error",
        description: "Failed to switch organization",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const RoleIcon = roleIcons[currentOrganization.role];

  // If user has only one organization, show simple logout button
  if (organizations.length <= 1) {
    return (
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={onLogout}
        className={className}
      >
        <LogOut className="w-4 h-4 mr-2" />
        Logout
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className={`flex items-center gap-2 ${className}`}
          disabled={loading}
        >
          <Avatar className="w-6 h-6">
            <AvatarImage src={currentOrganization.logo_url || undefined} />
            <AvatarFallback className="text-xs">
              {currentOrganization.name.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex items-center gap-1">
            <span className="font-medium text-sm truncate max-w-20">
              {currentOrganization.name}
            </span>
            <Badge 
              variant="secondary" 
              className={`text-xs ${roleColors[currentOrganization.role]} text-white`}
            >
              <RoleIcon className="w-3 h-3 mr-1" />
              {currentOrganization.role}
            </Badge>
          </div>
          
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="flex items-center gap-2">
          <Building2 className="w-4 h-4" />
          Switch Organization
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {organizations.map((org) => {
          const OrgRoleIcon = roleIcons[org.role];
          const isCurrent = org.id === currentOrganization.id;
          
          return (
            <DropdownMenuItem
              key={org.id}
              onClick={() => handleSwitchOrganization(org)}
              disabled={isCurrent || loading}
              className="flex items-center gap-3 p-3"
            >
              <Avatar className="w-8 h-8">
                <AvatarImage src={org.logo_url || undefined} />
                <AvatarFallback className="text-xs">
                  {org.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm truncate">
                    {org.name}
                  </span>
                  {isCurrent && (
                    <Badge variant="default" className="text-xs">
                      Current
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge 
                    variant="secondary" 
                    className={`text-xs ${roleColors[org.role]} text-white`}
                  >
                    <OrgRoleIcon className="w-3 h-3 mr-1" />
                    {org.role}
                  </Badge>
                </div>
              </div>
            </DropdownMenuItem>
          );
        })}
        
        <DropdownMenuSeparator />
        <div className="p-3">
          <JoinTeamCard 
            onTeamJoined={onTeamJoined}
            className="w-full"
          />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onLogout} className="text-red-600">
          <div className="flex items-center gap-2">
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
