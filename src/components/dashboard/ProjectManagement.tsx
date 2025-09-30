import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/enhanced-card";
import { Button } from "@/components/ui/enhanced-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { createProjectOversightHandlers } from "@/lib/project-oversight";
import { 
  Building2, 
  Plus, 
  Archive, 
  Users, 
  Calendar,
  Target,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock
} from "lucide-react";

type UserRole = "owner" | "admin" | "supervisor" | "employee";

interface Project {
  id: string;
  name: string;
  description?: string;
  organization_id: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  health?: {
    health: 'Good' | 'At Risk' | 'Blocked';
    completionRate: number;
    overdueTasks: number;
    nearingDueTasks: number;
    averageCycleTime: number;
  };
}

interface ProjectMember {
  user_id: string;
  role: UserRole;
  users: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
  };
}

interface ProjectManagementProps {
  organizationId: string;
  currentUserId: string;
  currentUserRole: UserRole;
}

export function ProjectManagement({ organizationId, currentUserId, currentUserRole }: ProjectManagementProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
  });
  const { toast } = useToast();

  const projectOversight = createProjectOversightHandlers(organizationId, currentUserId, currentUserRole, toast);

  useEffect(() => {
    fetchProjects();
  }, [organizationId]);

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get health for each project
      const projectsWithHealth = await Promise.all(
        (data || []).map(async (project) => {
          const health = await projectOversight.getProjectHealth(project.id);
          return { ...project, health };
        })
      );

      setProjects(projectsWithHealth);
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast({
        title: "Error",
        description: "Failed to load projects",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProject.name.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a project name",
        variant: "destructive",
      });
      return;
    }

    const project = await projectOversight.handleCreateProject({
      name: newProject.name,
      description: newProject.description,
    });

    if (project) {
      setNewProject({ name: "", description: "" });
      setCreateDialogOpen(false);
      fetchProjects(); // Refresh the list
    }
  };

  const handleArchiveProject = async (projectId: string) => {
    await projectOversight.handleArchiveProject(projectId);
    fetchProjects(); // Refresh the list
  };

  const getHealthIcon = (health: 'Good' | 'At Risk' | 'Blocked') => {
    switch (health) {
      case 'Good':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'At Risk':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'Blocked':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getHealthBadgeVariant = (health: 'Good' | 'At Risk' | 'Blocked') => {
    switch (health) {
      case 'Good':
        return 'default';
      case 'At Risk':
        return 'secondary';
      case 'Blocked':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Project Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="w-full h-10 bg-muted rounded"></div>
            <div className="w-full h-8 bg-muted rounded"></div>
            <div className="w-full h-8 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Project Management
            </div>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  New Project
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Project</DialogTitle>
                  <DialogDescription>
                    Create a new project for your organization
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Project Name</Label>
                    <Input
                      id="name"
                      placeholder="Enter project name"
                      value={newProject.name}
                      onChange={(e) => setNewProject(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Textarea
                      id="description"
                      placeholder="Enter project description"
                      value={newProject.description}
                      onChange={(e) => setNewProject(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <Button onClick={handleCreateProject} className="flex-1">
                      Create Project
                    </Button>
                    <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-4">
            {projects.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No projects found</p>
                <p className="text-sm">Create your first project to get started</p>
              </div>
            ) : (
              projects.map((project) => (
                <div key={project.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{project.name}</h3>
                        {project.health && (
                          <div className="flex items-center gap-1">
                            {getHealthIcon(project.health.health)}
                            <Badge variant={getHealthBadgeVariant(project.health.health)}>
                              {project.health.health}
                            </Badge>
                          </div>
                        )}
                      </div>
                      
                      {project.description && (
                        <p className="text-sm text-muted-foreground mb-3">{project.description}</p>
                      )}
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Created {new Date(project.created_at).toLocaleDateString()}
                        </div>
                        {project.health && (
                          <>
                            <div className="flex items-center gap-1">
                              <Target className="w-3 h-3" />
                              {project.health.completionRate}% complete
                            </div>
                            <div className="flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" />
                              {project.health.averageCycleTime} days avg
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm">
                        <Users className="w-4 h-4" />
                      </Button>
                      
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Archive className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Archive Project</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to archive "{project.name}"? 
                              This will mark the project as archived but won't delete it.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleArchiveProject(project.id)}>
                              Archive Project
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  
                  {project.health && (
                    <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Target className="w-3 h-3 text-blue-500" />
                        <span>{project.health.completionRate}% Complete</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-red-500" />
                        <span>{project.health.overdueTasks} Overdue</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-yellow-500" />
                        <span>{project.health.nearingDueTasks} Due Soon</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-green-500" />
                        <span>{project.health.averageCycleTime}d Avg</span>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
