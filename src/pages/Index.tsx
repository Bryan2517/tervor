import { useState, useEffect } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { AuthPage } from "@/components/auth/AuthPage";
import { OrganizationSelector } from "@/components/org/OrganizationSelector";
import { RoleDashboard } from "@/components/dashboard/RoleDashboard";

type UserRole = "owner" | "admin" | "supervisor" | "employee";

interface OrganizationWithRole {
  id: string;
  name: string;
  logo_url?: string;
  role: UserRole;
}

const Index = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [selectedOrganization, setSelectedOrganization] = useState<OrganizationWithRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Function to check and set last selected organization
    const loadLastSelectedOrg = async (userId: string) => {
      const { data } = await supabase
        .from("organization_members")
        .select(`
          role,
          organization:organizations(*)
        `)
        .eq("user_id", userId)
        .eq("last_selected", true)
        .single();

      if (data?.organization) {
        setSelectedOrganization({
          ...data.organization,
          role: data.role,
        } as OrganizationWithRole);
      }
    };

    // Check for existing session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setSession(session);
        setUser(session.user);
        await loadLastSelectedOrg(session.user.id);
      }
      setLoading(false);
    };

    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (!session) {
          setSelectedOrganization(null);
        } else if (event === 'SIGNED_IN' && session.user) {
          // Load last selected organization after sign in
          await loadLastSelectedOrg(session.user.id);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Listen for organization updates (like logo changes)
  useEffect(() => {
    if (!selectedOrganization) return;

    const channel = supabase
      .channel(`org-${selectedOrganization.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'organizations',
          filter: `id=eq.${selectedOrganization.id}`,
        },
        (payload) => {
          // Update the organization with new data (like logo_url)
          setSelectedOrganization((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              ...payload.new,
            } as OrganizationWithRole;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedOrganization?.id]);

  const handleAuthSuccess = (session: Session, user: User) => {
    setSession(session);
    setUser(user);
  };

  const handleOrganizationSelect = (org: OrganizationWithRole) => {
    // Just set the organization, clock in will be handled by confirmation dialog
    setSelectedOrganization(org);
  };

  const handleClockOut = () => {
    // Just clear organization, clock out will be handled by confirmation dialog
    setSelectedOrganization(null);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setSelectedOrganization(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show auth page if not authenticated
  if (!session || !user) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  // Show organization selector if no organization selected
  if (!selectedOrganization) {
    return <OrganizationSelector onOrganizationSelect={handleOrganizationSelect} />;
  }

  // Show main dashboard
  return (
    <RoleDashboard 
      organization={selectedOrganization} 
      onLogout={handleLogout}
      onClockOut={handleClockOut}
    />
  );
};

export default Index;
