import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { OwnerDashboard } from "./roles/OwnerDashboard";
import { AdminDashboard } from "./roles/AdminDashboard";
import { SupervisorDashboard } from "./roles/SupervisorDashboard";
import { EmployeeDashboard } from "./EmployeeDashboard";

type UserRole = "owner" | "admin" | "supervisor" | "employee";

interface OrganizationWithRole {
  id: string;
  name: string;
  logo_url?: string;
  role: UserRole;
}

interface RoleDashboardProps {
  organization: OrganizationWithRole;
  onOrganizationChange: (org: OrganizationWithRole) => void;
  onOrganizationJoined: (org: OrganizationWithRole) => void;
  onLogout: () => void;
}

export function RoleDashboard({ organization, onOrganizationChange, onOrganizationJoined, onLogout }: RoleDashboardProps) {
  // Render the appropriate dashboard based on user role
  switch (organization.role) {
    case "owner":
      return <OwnerDashboard organization={organization} onOrganizationChange={onOrganizationChange} onOrganizationJoined={onOrganizationJoined} onLogout={onLogout} />;
    case "admin":
      return <AdminDashboard organization={organization} onOrganizationChange={onOrganizationChange} onOrganizationJoined={onOrganizationJoined} onLogout={onLogout} />;
    case "supervisor":
      return <SupervisorDashboard organization={organization} onOrganizationChange={onOrganizationChange} onOrganizationJoined={onOrganizationJoined} onLogout={onLogout} />;
    case "employee":
    default:
      return <EmployeeDashboard organization={organization} onOrganizationChange={onOrganizationChange} onOrganizationJoined={onOrganizationJoined} onLogout={onLogout} />;
  }
}