import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, FolderOpen, Users, Calendar, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";

interface Project {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  organization_id: string;
  totalTasks?: number;
  completedTasks?: number;
  myAssignments?: number;
  progressPercentage?: number;
}

export default function SupervisorProjects() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { organization } = useOrganization();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (organization) {
      fetchProjects();
    }
  }, [organization]);

  const fetchProjects = async () => {
    if (!organization) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch all projects in the organization
      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select("id, name, description, created_at, organization_id")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false });

      if (projectsError) throw projectsError;

      // Fetch task statistics for each project
      const projectsWithStats = await Promise.all(
        (projectsData || []).map(async (project) => {
          // Get all tasks for this project
          const { data: tasksData } = await supabase
            .from("tasks")
            .select("id, status, assignee_id, task_type")
            .eq("project_id", project.id);

          const totalTasks = tasksData?.filter(t => t.task_type === 'task').length || 0;
          const completedTasks = tasksData?.filter(t => t.task_type === 'task' && t.status === 'done').length || 0;
          const myAssignments = tasksData?.filter(t => t.task_type === 'assignment' && t.assignee_id === user.id).length || 0;
          const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

          return {
            ...project,
            totalTasks,
            completedTasks,
            myAssignments,
            progressPercentage,
          };
        })
      );

      setProjects(projectsWithStats);
    } catch (error: any) {
      console.error("Error fetching projects:", error);
      toast({
        title: "Error",
        description: "Failed to load projects",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold">Projects</h1>
                <p className="text-sm text-muted-foreground">View and manage organization projects</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Organization Info */}
        <div className="mb-6 p-4 bg-muted/50 rounded-lg">
          <p className="text-sm font-medium text-muted-foreground">Organization</p>
          <p className="text-lg font-semibold">{organization?.name || "No organization selected"}</p>
        </div>

        {projects.length === 0 ? (
          <Card className="py-12">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <FolderOpen className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                There are no projects in this organization yet
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card key={project.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FolderOpen className="w-5 h-5" />
                    {project.name}
                  </CardTitle>
                  <CardDescription className="line-clamp-2">
                    {project.description || "No description provided"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Progress */}
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{project.progressPercentage}%</span>
                    </div>
                    <Progress value={project.progressPercentage} className="h-2" />
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Tasks</p>
                        <p className="font-semibold">{project.totalTasks}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">My Assignments</p>
                        <p className="font-semibold">{project.myAssignments}</p>
                      </div>
                    </div>
                  </div>

                  {/* Created Date */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
                    <Calendar className="w-3 h-3" />
                    <span>Created {new Date(project.created_at).toLocaleDateString()}</span>
                  </div>

                  {/* View Details Button */}
                  <Button 
                    className="w-full"
                    onClick={() => navigate(`/supervisor/projects/${project.name}`)}
                  >
                    View Details
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


