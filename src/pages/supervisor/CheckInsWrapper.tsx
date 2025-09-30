import { useParams } from "react-router-dom";
import { CheckInsPage } from "./CheckIns";

export function CheckInsWrapper() {
  // TODO: Get these from context or props in a real implementation
  // For now, using a placeholder that should be replaced with actual context
  const organizationId = "329a8790-40d8-4ebb-8913-9e2189a3ac28"; // Replace with actual org ID from context
  const organizationName = "Your Organization"; // Replace with actual org name from context

  return (
    <CheckInsPage 
      organizationId={organizationId}
      organizationName={organizationName}
    />
  );
}
