import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

type UserRole = "owner" | "admin" | "supervisor" | "employee";

interface OrganizationWithRole {
  id: string;
  name: string;
  logo_url?: string;
  role: UserRole;
}

interface OrganizationContextType {
  organization: OrganizationWithRole | null;
  setOrganization: (org: OrganizationWithRole | null) => void;
  loading: boolean;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [organization, setOrganization] = useState<OrganizationWithRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOrganization = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        // Get the last selected organization
        const { data } = await supabase
          .from("organization_members")
          .select(`
            role,
            organization:organizations(*)
          `)
          .eq("user_id", user.id)
          .eq("last_selected", true)
          .single();

        if (data?.organization) {
          setOrganization({
            ...data.organization,
            role: data.role,
          } as OrganizationWithRole);
        }
      } catch (error) {
        console.error("Error loading organization:", error);
      } finally {
        setLoading(false);
      }
    };

    loadOrganization();
  }, []);

  return (
    <OrganizationContext.Provider value={{ organization, setOrganization, loading }}>
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error("useOrganization must be used within an OrganizationProvider");
  }
  return context;
}

