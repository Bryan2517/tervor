import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { ThemeProvider } from "@/components/theme-provider";
import Index from "./pages/Index";
import { InvitePage } from "./pages/InvitePage";
import { OrganizationSettings } from "./pages/owner/OrganizationSettings";
import { ManageProjects } from "./pages/owner/ManageProjects";
import { ProjectDetail } from "./pages/owner/ProjectDetail";
import CreateProject from "./pages/owner/CreateProject";
import CreateTask from "./pages/owner/CreateTask";
import CreateAssignment from "./pages/owner/CreateAssignment";
import { ProjectDetail as AdminProjectDetail } from "./pages/admin/ProjectDetail";
import { Analytics } from "./pages/owner/Analytics";
import { TeamManagement } from "./pages/owner/TeamManagement";
import { Teams } from "./pages/owner/Teams";
import { Settings } from "./pages/owner/Settings";
import { ShopManagement } from "./pages/owner/ShopManagement";
import { TasksOverview } from "./pages/owner/TasksOverview";
import ExtensionRequests from "./pages/owner/ExtensionRequests";
import { ManageTeam } from "./pages/admin/ManageTeam";
import { Analytics as AdminAnalytics } from "./pages/admin/Analytics";
import AdminExtensionRequests from "./pages/admin/ExtensionRequests";
import { TaskAssignment } from "./pages/admin/TaskAssignment";
import { ProgressTracking } from "./pages/admin/ProgressTracking";
import { TimeManagement } from "./pages/admin/TimeManagement";
import { QualityReview } from "./pages/admin/QualityReview";
import { ShopManagement as AdminShopManagement } from "./pages/admin/ShopManagement";
import { Settings as AdminSettings } from "./pages/admin/Settings";
import { TeamManagement as AdminTeamManagement } from "./pages/admin/TeamManagement";
import { Shop } from "./pages/shared/Shop";
import { TimeLoggingReport } from "./pages/shared/TimeLoggingReport";
import { AttendanceHistory } from "./pages/shared/AttendanceHistory";
import SupervisorManageTeam from "./pages/supervisor/ManageTeam";
import SupervisorProjects from "./pages/supervisor/Projects";
import { ProjectDetail as SupervisorProjectDetail } from "./pages/supervisor/ProjectDetail";
import SupervisorTaskAssignment from "./pages/supervisor/TaskAssignment";
import SupervisorProgressTracking from "./pages/supervisor/ProgressTracking";
import SupervisorTimeManagement from "./pages/supervisor/TimeManagement";
import SupervisorQualityReview from "./pages/supervisor/QualityReview";
import SupervisorDirectReports from "./pages/supervisor/DirectReports";
import SupervisorTaskOverseeing from "./pages/supervisor/TaskOverseeing";
import SupervisorCompleteToday from "./pages/supervisor/CompleteToday";
import { Settings as SupervisorSettings } from "./pages/supervisor/Settings";
import { Settings as EmployeeSettings } from "./pages/employee/Settings";
import EmployeeProjects from "./pages/employee/Projects";
import { ProjectDetail as EmployeeProjectDetail } from "./pages/employee/ProjectDetail";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OrganizationProvider } from "./contexts/OrganizationContext";

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
        path: "owner/projects/new",
        element: <CreateProject />,
      },
      {
        path: "owner/projects/:projectName",
        element: <ProjectDetail />,
      },
      {
        path: "owner/tasks/new",
        element: <CreateTask />,
      },
      {
        path: "owner/assignments/new",
        element: <CreateAssignment />,
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
        path: "owner/teams",
        element: <Teams />,
      },
      {
        path: "owner/settings",
        element: <Settings />,
      },
      {
        path: "owner/time-logging",
        element: <TimeLoggingReport />,
      },
      {
        path: "owner/attendance-history",
        element: <AttendanceHistory />,
      },
      {
        path: "owner/shop",
        element: <Shop />,
      },
      {
        path: "owner/shop/manage",
        element: <ShopManagement />,
      },
      {
        path: "owner/tasks",
        element: <TasksOverview />,
      },
      {
        path: "owner/extension-requests",
        element: <ExtensionRequests />,
      },
      {
        path: "admin/analytics",
        element: <AdminAnalytics />,
      },
      {
        path: "admin/manage-team",
        element: <ManageTeam />,
      },
      {
        path: "admin/teams",
        element: <AdminTeamManagement />,
      },
      {
        path: "admin/task-assignment",
        element: <TaskAssignment />,
      },
      {
        path: "admin/progress-tracking",
        element: <ProgressTracking />,
      },
      {
        path: "admin/progress-tracking/:projectName",
        element: <AdminProjectDetail />,
      },
      {
        path: "admin/time-management",
        element: <TimeManagement />,
      },
      {
        path: "admin/quality-review",
        element: <QualityReview />,
      },
      {
        path: "admin/shop",
        element: <Shop />,
      },
      {
        path: "admin/shop/manage",
        element: <AdminShopManagement />,
      },
      {
        path: "admin/settings",
        element: <AdminSettings />,
      },
      {
        path: "admin/time-logging",
        element: <TimeLoggingReport />,
      },
      {
        path: "admin/attendance-history",
        element: <AttendanceHistory />,
      },
      {
        path: "admin/extension-requests",
        element: <AdminExtensionRequests />,
      },
      {
        path: "supervisor/shop",
        element: <Shop />,
      },
      {
        path: "employee/shop",
        element: <Shop />,
      },
      {
        path: "employee/projects",
        element: <EmployeeProjects />,
      },
      {
        path: "employee/projects/:projectName",
        element: <EmployeeProjectDetail />,
      },
      {
        path: "supervisor/projects",
        element: <SupervisorProjects />,
      },
      {
        path: "supervisor/projects/:projectName",
        element: <SupervisorProjectDetail />,
      },
      {
        path: "supervisor/manage-team",
        element: <SupervisorManageTeam />,
      },
      {
        path: "supervisor/task-assignment",
        element: <SupervisorTaskAssignment />,
      },
      {
        path: "supervisor/progress-tracking",
        element: <SupervisorProgressTracking />,
      },
      {
        path: "supervisor/time-management",
        element: <SupervisorTimeManagement />,
      },
      {
        path: "supervisor/quality-review",
        element: <SupervisorQualityReview />,
      },
      {
        path: "supervisor/direct-reports",
        element: <SupervisorDirectReports />,
      },
      {
        path: "supervisor/task-overseeing",
        element: <SupervisorTaskOverseeing />,
      },
      {
        path: "supervisor/complete-today",
        element: <SupervisorCompleteToday />,
      },
      {
        path: "supervisor/settings",
        element: <SupervisorSettings />,
      },
      {
        path: "supervisor/attendance-history",
        element: <AttendanceHistory />,
      },
      {
        path: "employee/settings",
        element: <EmployeeSettings />,
      },
      {
        path: "employee/attendance-history",
        element: <AttendanceHistory />,
      },
    ],
  },
]);

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <OrganizationProvider>
        <ThemeProvider>
          <RouterProvider router={router} />
        </ThemeProvider>
      </OrganizationProvider>
    </QueryClientProvider>
  </StrictMode>
);

