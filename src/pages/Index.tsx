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
    // Check for existing session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setSession(session);
        setUser(session.user);
        
        // Check for last selected organization
        const { data } = await supabase
          .from("organization_members")
          .select(`
            role,
            organization:organizations(*)
          `)
          .eq("user_id", session.user.id)
          .eq("last_selected", true)
          .single();

        if (data?.organization) {
          setSelectedOrganization({
            ...data.organization,
            role: data.role,
          } as OrganizationWithRole);
        }
      }
      setLoading(false);
    };

    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (!session) {
          setSelectedOrganization(null);
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
    setSelectedOrganization(org);
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
    />
  );
};

export default Index;
