import { useParams } from "react-router-dom";
import { CheckInsPage } from "./CheckIns";

export function CheckInsWrapper() {
  // In a real app, you'd get these from context or props
  // For now, we'll use placeholder values that should be replaced with actual context
  const organizationId = "current-org-id"; // This should come from useOrg() context
  const organizationName = "Current Organization"; // This should come from useOrg() context

  return (
    <CheckInsPage 
      organizationId={organizationId}
      organizationName={organizationName}
    />
  );
}
