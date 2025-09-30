import { useState } from "react";
import { OrganizationSwitchButton } from "../dashboard/shared/OrganizationSwitchButton";

// Example of how to use the OrganizationSwitchButton in any header
export function HeaderWithOrganizationSwitch() {
  const [currentOrganization, setCurrentOrganization] = useState({
    id: "org-1",
    name: "Acme Corp",
    description: "Software Company",
    logo_url: "/logo.png",
    role: "owner" as const,
  });

  const handleOrganizationChange = (org: any) => {
    setCurrentOrganization(org);
    // Handle organization change logic here
    console.log("Switched to organization:", org);
  };

  const handleLogout = () => {
    // Handle logout logic here
    console.log("User logged out");
  };

  return (
    <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Left side - Logo/Brand */}
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold">AC</span>
            </div>
            <div>
              <h1 className="text-xl font-semibold">My App</h1>
              <p className="text-sm text-muted-foreground">Dashboard</p>
            </div>
          </div>
          
          {/* Right side - Organization Switch Button */}
          <div className="flex items-center gap-4">
            <OrganizationSwitchButton 
              currentOrganization={currentOrganization}
              onOrganizationChange={handleOrganizationChange}
              onLogout={handleLogout}
            />
          </div>
        </div>
      </div>
    </header>
  );
}

// Example with custom styling
export function CustomStyledHeader() {
  const [currentOrganization, setCurrentOrganization] = useState({
    id: "org-1",
    name: "Tech Startup",
    description: "Innovation Company",
    logo_url: "/startup-logo.png",
    role: "admin" as const,
  });

  const handleOrganizationChange = (org: any) => {
    setCurrentOrganization(org);
  };

  const handleLogout = () => {
    console.log("User logged out");
  };

  return (
    <header className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">Tech Dashboard</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <OrganizationSwitchButton 
              currentOrganization={currentOrganization}
              onOrganizationChange={handleOrganizationChange}
              onLogout={handleLogout}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20"
            />
          </div>
        </div>
      </div>
    </header>
  );
}

// Example with multiple buttons in header
export function HeaderWithMultipleButtons() {
  const [currentOrganization, setCurrentOrganization] = useState({
    id: "org-1",
    name: "Enterprise Corp",
    description: "Large Enterprise",
    logo_url: "/enterprise-logo.png",
    role: "supervisor" as const,
  });

  const handleOrganizationChange = (org: any) => {
    setCurrentOrganization(org);
  };

  const handleLogout = () => {
    console.log("User logged out");
  };

  return (
    <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold">Enterprise Dashboard</h1>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Other header buttons */}
            <button className="px-3 py-2 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200">
              Notifications
            </button>
            <button className="px-3 py-2 text-sm bg-green-100 text-green-700 rounded-md hover:bg-green-200">
              Settings
            </button>
            
            {/* Organization Switch Button */}
            <OrganizationSwitchButton 
              currentOrganization={currentOrganization}
              onOrganizationChange={handleOrganizationChange}
              onLogout={handleLogout}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
