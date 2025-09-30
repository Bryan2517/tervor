import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Index from "./pages/Index";
import { InvitePage } from "./pages/InvitePage";
import { OrganizationSettings } from "./pages/owner/OrganizationSettings";
import { ManageProjects } from "./pages/owner/ManageProjects";
import { Analytics } from "./pages/owner/Analytics";
import { TeamManagement } from "./pages/owner/TeamManagement";
import { Settings } from "./pages/owner/Settings";
import { ShopManagement } from "./pages/owner/ShopManagement";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: <Index />,
      },
      {
        path: "invite/:code",
        element: <InvitePage />,
      },
      {
        path: "owner/organization-settings",
        element: <OrganizationSettings />,
      },
      {
        path: "owner/projects",
        element: <ManageProjects />,
      },
      {
        path: "owner/analytics",
        element: <Analytics />,
      },
      {
        path: "owner/team",
        element: <TeamManagement />,
      },
      {
        path: "owner/settings",
        element: <Settings />,
      },
      {
        path: "owner/shop",
        element: <ShopManagement />,
      },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);