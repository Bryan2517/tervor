import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/enhanced-card";
import { Button } from "@/components/ui/enhanced-button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Building, Users, Crown, ShieldCheck, UserCheck, UserIcon } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type Organization = Tables<"my_organizations">;
type UserRole = "owner" | "admin" | "manager" | "employee";

interface OrganizationWithRole extends Organization {
  role: UserRole;
}

interface OrganizationSelectorProps {
  onOrganizationSelect: (org: OrganizationWithRole) => void;
}

const roleIcons = {
  owner: Crown,
  admin: ShieldCheck,
  manager: UserCheck,
  employee: UserIcon,
};

const roleColors = {
  owner: "bg-gradient-points",
  admin: "bg-primary",
  manager: "bg-accent",
  employee: "bg-secondary",
};

export function OrganizationSelector({ onOrganizationSelect }: OrganizationSelectorProps) {
  const [organizations, setOrganizations] = useState<OrganizationWithRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from("organization_members")
        .select(`
          role,
          organization:organizations(*)
        `)
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id);

      if (error) throw error;

      const orgsWithRoles = data
        ?.filter(item => item.organization)
        .map(item => ({
          ...item.organization,
          role: item.role,
        })) as OrganizationWithRole[];

      setOrganizations(orgsWithRoles || []);
    } catch (error) {
      console.error("Error fetching organizations:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOrganization = async (org: OrganizationWithRole) => {
    // Update last_selected for this organization
    await supabase
      .from("organization_members")
      .update({ last_selected: false })
      .eq("user_id", (await supabase.auth.getUser()).data.user?.id);

    await supabase
      .from("organization_members")
      .update({ last_selected: true })
      .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
      .eq("organization_id", org.id);

    onOrganizationSelect(org);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (organizations.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card variant="elevated" className="w-full max-w-md text-center">
          <CardHeader>
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Building className="w-8 h-8 text-muted-foreground" />
            </div>
            <CardTitle>No Organizations</CardTitle>
            <CardDescription>
              You're not a member of any organization yet. Ask your admin for an invite link to join.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              Join with Invite Code
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (organizations.length === 1) {
    // Auto-select if only one organization
    handleSelectOrganization(organizations[0]);
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Select Organization</h1>
          <p className="text-muted-foreground">Choose which organization you'd like to work with today</p>
        </div>

        <div className="grid gap-4">
          {organizations.map((org) => {
            const RoleIcon = roleIcons[org.role];
            
            return (
              <Card
                key={org.id}
                variant="interactive"
                className="cursor-pointer"
                onClick={() => handleSelectOrganization(org)}
              >
                <CardContent className="flex items-center gap-4 p-6">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={org.logo_url || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                      {org.name?.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-semibold">{org.name}</h3>
                      <Badge variant="secondary" className={cn("text-xs", roleColors[org.role])}>
                        <RoleIcon className="w-3 h-3 mr-1" />
                        {org.role}
                      </Badge>
                    </div>
                    {org.description && (
                      <p className="text-sm text-muted-foreground">{org.description}</p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span className="text-sm">Team</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}