import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, FolderOpen, Calendar, GitBranch } from "lucide-react";
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
  overdueTasks?: number;
  progressPercentage?: number;
  current_phase?: string;
  tasks?: {
    status: string;
    due_date?: string;
  }[];
}

export function ProgressTracking() {
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
      const { data, error } = await supabase
        .from("projects")
        .select(`
          id,
          name,
          description,
          created_at,
          organization_id,
          current_phase,
          tasks(
            status,
            due_date
          )
        `)
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data) {
        const projectsWithStats = data.map((project) => {
          const tasks = project.tasks || [];
          const totalTasks = tasks.length;
          const completedTasks = tasks.filter(task => task.status === 'done').length;
          
          // Calculate overdue tasks - tasks that are not done and have a past due date
          const overdueTasks = tasks.filter(task => 
            task.status !== 'done' && 
            task.due_date && 
            new Date(task.due_date) < new Date()
          ).length;
          
          const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

          return {
            ...project,
            totalTasks,
            completedTasks,
            overdueTasks,
            progressPercentage,
          };
        });

        setProjects(projectsWithStats);
      }
    } catch (error) {
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
                <h1 className="text-xl font-semibold">Progress Tracking</h1>
                <p className="text-sm text-muted-foreground">Monitor project progress and completion rates</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        {projects.length === 0 ? (
          <Card className="py-12">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <FolderOpen className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                There are no projects to track in your organization
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => {
              const pendingTasks = (project.totalTasks || 0) - (project.completedTasks || 0);
              
              return (
                <Card key={project.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FolderOpen className="w-5 h-5" />
                      {project.name}
                    </CardTitle>
                    <CardDescription>
                      {project.description || "No description"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(project.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    
                    {/* Project Phase */}
                    {project.current_phase && (
                      <div className="flex items-center gap-2 mt-3 pb-2 border-b">
                        <GitBranch className="w-5 h-5 text-primary" />
                        <span className="text-base font-semibold text-primary">{project.current_phase}</span>
                      </div>
                    )}
                    
                    {/* Progress Bar */}
                    <div className="space-y-2 my-4">
                      <div className="flex justify-between text-sm">
                        <span>Progress</span>
                        <span className="font-medium">{project.progressPercentage || 0}%</span>
                      </div>
                      <Progress value={project.progressPercentage || 0} className="w-full" />
                      <div className="text-xs text-muted-foreground text-center">
                        {project.completedTasks || 0} of {project.totalTasks || 0} tasks completed
                      </div>
                    </div>
                    
                    {/* Task Statistics */}
                    <div className="grid grid-cols-4 gap-2 pt-4 border-t text-center">
                      <div>
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="text-lg font-semibold">{project.totalTasks || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Done</p>
                        <p className="text-lg font-semibold text-green-600">{project.completedTasks || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Pending</p>
                        <p className="text-lg font-semibold text-orange-600">
                          {pendingTasks}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Overdue</p>
                        <p className="text-lg font-semibold text-red-600">
                          {project.overdueTasks || 0}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 mt-4">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => navigate(`/admin/progress-tracking/${encodeURIComponent(project.name)}`)}
                      >
                        View Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}