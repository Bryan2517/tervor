import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Plus, FolderOpen, Users, Calendar, Coins } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
}

export function ManageProjects() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { organization } = useOrganization();
  const [projects, setProjects] = useState<Project[]>([]);
  const [admins, setAdmins] = useState<Array<{user_id: string, users: {full_name: string}}>>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
    assigned_admin_id: "",
    completion_points: 0,
  });

  useEffect(() => {
    if (organization) {
      fetchProjects();
      fetchAdmins();
    }
  }, [organization]);

  const fetchAdmins = async () => {
    if (!organization) return;
    
    try {
      const { data } = await supabase
        .from("organization_members")
        .select("user_id, users!inner(full_name)")
        .eq("organization_id", organization.id)
        .eq("role", "admin");
      
      if (data) {
        setAdmins(data as any);
      }
    } catch (error) {
      console.error("Error fetching admins:", error);
    }
  };

  const fetchProjects = async () => {
    if (!organization) return;
    
    try {
      const { data } = await supabase
        .from("projects")
        .select("*")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false });

        if (data) {
          // Fetch task counts for each project including due dates for overdue calculation
          const projectsWithStats = await Promise.all(
            data.map(async (project) => {
              const { data: tasksData } = await supabase
                .from("tasks")
                .select("id, status, due_date")
                .eq("project_id", project.id);

              const totalTasks = tasksData?.length || 0;
              const completedTasks = tasksData?.filter(task => task.status === 'done').length || 0;
              
              // Calculate overdue tasks - tasks that are not done and have a past due date
              const overdueTasks = tasksData?.filter(task => 
                task.status !== 'done' && 
                task.due_date && 
                new Date(task.due_date) < new Date()
              ).length || 0;
              
              const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

              return {
                ...project,
                totalTasks,
                completedTasks,
                overdueTasks,
                progressPercentage,
              };
            })
          );

        setProjects(projectsWithStats);
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!newProject.name.trim()) {
      toast({
        title: "Error",
        description: "Project name is required",
        variant: "destructive",
      });
      return;
    }

    if (!organization) {
      toast({
        title: "Error",
        description: "No organization selected",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("projects")
        .insert({
          name: newProject.name,
          description: newProject.description,
          organization_id: organization.id,
          owner_id: user.id,
          assigned_admin_id: newProject.assigned_admin_id || null,
          completion_points: newProject.completion_points || 0,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Project created successfully",
      });

      setDialogOpen(false);
      setNewProject({ name: "", description: "", assigned_admin_id: "", completion_points: 0 });
      fetchProjects();
    } catch (error) {
      console.error("Error creating project:", error);
      toast({
        title: "Error",
        description: "Failed to create project",
        variant: "destructive",
      });
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
                <h1 className="text-xl font-semibold">Manage Projects</h1>
                <p className="text-sm text-muted-foreground">Create and manage organization projects</p>
              </div>
            </div>
            <Button onClick={() => navigate("/owner/projects/new")}>
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button style={{ display: 'none' }}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Project
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Project</DialogTitle>
                  <DialogDescription>
                    Add a new project to your organization
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="project-name">Project Name</Label>
                    <Input
                      id="project-name"
                      value={newProject.name}
                      onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                      placeholder="Enter project name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="project-description">Description</Label>
                    <Textarea
                      id="project-description"
                      value={newProject.description}
                      onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                      placeholder="Enter project description"
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assigned-admin">Assign to Admin (Optional)</Label>
                    <Select
                      value={newProject.assigned_admin_id}
                      onValueChange={(value) => setNewProject({ ...newProject, assigned_admin_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select an admin" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No Admin</SelectItem>
                        {admins.map((admin) => (
                          <SelectItem key={admin.user_id} value={admin.user_id}>
                            {admin.users.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="completion-points">Completion Points</Label>
                    <div className="relative">
                      <Coins className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="completion-points"
                        type="number"
                        min="0"
                        value={newProject.completion_points}
                        onChange={(e) => setNewProject({ ...newProject, completion_points: parseInt(e.target.value) || 0 })}
                        placeholder="Points to award on completion"
                        className="pl-10"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Points awarded to the assigned admin when the project is completed</p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateProject}>Create Project</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
                Get started by creating your first project
              </p>
              <Button onClick={() => navigate("/owner/projects/new")}>
                <Plus className="w-4 h-4 mr-2" />
                Create Project
              </Button>
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
                    
                    {/* Task Statistics - Matching Admin's ProgressTracking */}
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
                        onClick={() => navigate(`/owner/projects/${encodeURIComponent(project.name)}`)}
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