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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { 
  Target, 
  Plus, 
  Users, 
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  Edit,
  Trash2
} from "lucide-react";

type UserRole = "owner" | "admin" | "supervisor" | "employee";
type TaskPriority = "low" | "medium" | "high";
type TaskStatus = "todo" | "in_progress" | "in_review" | "done";

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_date?: string;
  assignee_id?: string;
  project_id: string;
  created_at: string;
  updated_at: string;
  assignee?: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
  };
  project?: {
    id: string;
    name: string;
  };
}

interface Employee {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  current_tasks_count: number;
}

interface Project {
  id: string;
  name: string;
  organization_id: string;
}

interface TaskAssignmentProps {
  organizationId: string;
  currentUserId: string;
  currentUserRole: UserRole;
}

export function TaskAssignment({ organizationId, currentUserId, currentUserRole }: TaskAssignmentProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium" as TaskPriority,
    due_date: "",
    assignee_id: "",
    project_id: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, [organizationId]);

  const fetchData = async () => {
    try {
      const [tasksData, employeesData, projectsData] = await Promise.all([
        // Fetch tasks for projects in this organization
        supabase
          .from('tasks')
          .select(`
            *,
            assignee:users!tasks_assignee_id_fkey(id, full_name, email, avatar_url),
            project:projects!tasks_project_id_fkey(id, name)
          `)
          .in('project_id', await getProjectIds()),
        
        // Fetch employees in the organization
        supabase
          .from('organization_members')
          .select(`
            user_id,
            role,
            users!inner(id, full_name, email, avatar_url)
          `)
          .eq('organization_id', organizationId),
        
        // Fetch projects in the organization
        supabase
          .from('projects')
          .select('id, name')
          .eq('organization_id', organizationId)
      ]);

      if (tasksData.error) throw tasksData.error;
      if (employeesData.error) throw employeesData.error;
      if (projectsData.error) throw projectsData.error;

      // Filter employees on client side
      const employees = (employeesData.data || []).filter(member => member.role === 'employee');
      
      // Process employees with task counts
      const employeesWithCounts = await Promise.all(
        employees.map(async (member: any) => {
          const { data: taskCount } = await supabase
            .from('tasks')
            .select('id', { count: 'exact' })
            .eq('assignee_id', member.user_id)
            .in('status', ['todo', 'in_progress']);

          return {
            id: member.user_id,
            full_name: member.users.full_name,
            email: member.users.email,
            avatar_url: member.users.avatar_url,
            current_tasks_count: taskCount?.length || 0,
          };
        })
      );

      setTasks(tasksData.data || []);
      setEmployees(employeesWithCounts);
      setProjects(projectsData.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load task assignment data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getProjectIds = async () => {
    const { data } = await supabase
      .from('projects')
      .select('id')
      .eq('organization_id', organizationId);
    return data?.map(p => p.id) || [];
  };

  const handleCreateTask = async () => {
    if (!newTask.title.trim() || !newTask.project_id) {
      toast({
        title: "Required Fields",
        description: "Please fill in task title and select a project",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          title: newTask.title,
          description: newTask.description,
          priority: newTask.priority,
          due_date: newTask.due_date || null,
          assignee_id: newTask.assignee_id || null,
          project_id: newTask.project_id,
          status: 'todo',
        })
        .select(`
          *,
          assignee:users!tasks_assignee_id_fkey(id, full_name, email, avatar_url),
          project:projects!tasks_project_id_fkey(id, name)
        `)
        .single();

      if (error) throw error;

      setTasks(prev => [data, ...prev]);
      setNewTask({
        title: "",
        description: "",
        priority: "medium",
        due_date: "",
        assignee_id: "",
        project_id: "",
      });
      setCreateDialogOpen(false);

      toast({
        title: "Task Created",
        description: "Task has been assigned successfully",
      });
    } catch (error) {
      console.error('Error creating task:', error);
      toast({
        title: "Error",
        description: "Failed to create task",
        variant: "destructive",
      });
    }
  };

  const handleUpdateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (error) throw error;

      setTasks(prev => prev.map(task => 
        task.id === taskId ? { ...task, status: newStatus } : task
      ));

      toast({
        title: "Status Updated",
        description: "Task status has been updated",
      });
    } catch (error) {
      console.error('Error updating task status:', error);
      toast({
        title: "Error",
        description: "Failed to update task status",
        variant: "destructive",
      });
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      setTasks(prev => prev.filter(task => task.id !== taskId));

      toast({
        title: "Task Deleted",
        description: "Task has been removed",
      });
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({
        title: "Error",
        description: "Failed to delete task",
        variant: "destructive",
      });
    }
  };

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'todo': return 'bg-gray-100 text-gray-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'in_review': return 'bg-yellow-100 text-yellow-800';
      case 'done': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const isOverdue = (dueDate: string) => {
    return new Date(dueDate) < new Date() && new Date(dueDate).toDateString() !== new Date().toDateString();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Task Assignment
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
              <Target className="w-5 h-5" />
              Task Assignment
            </div>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Assign Task
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Assign New Task</DialogTitle>
                  <DialogDescription>
                    Create and assign a task to a team member
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">Task Title</Label>
                    <Input
                      id="title"
                      placeholder="Enter task title"
                      value={newTask.title}
                      onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Enter task description"
                      value={newTask.description}
                      onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="priority">Priority</Label>
                      <Select 
                        value={newTask.priority} 
                        onValueChange={(value: TaskPriority) => setNewTask(prev => ({ ...prev, priority: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="due_date">Due Date</Label>
                      <Input
                        id="due_date"
                        type="date"
                        value={newTask.due_date}
                        onChange={(e) => setNewTask(prev => ({ ...prev, due_date: e.target.value }))}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="project">Project</Label>
                      <Select 
                        value={newTask.project_id} 
                        onValueChange={(value) => setNewTask(prev => ({ ...prev, project_id: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select project" />
                        </SelectTrigger>
                        <SelectContent>
                          {projects.map(project => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label htmlFor="assignee">Assign To</Label>
                      <Select 
                        value={newTask.assignee_id} 
                        onValueChange={(value) => setNewTask(prev => ({ ...prev, assignee_id: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select employee" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map(employee => (
                            <SelectItem key={employee.id} value={employee.id}>
                              <div className="flex items-center gap-2">
                                <span>{employee.full_name}</span>
                                <span className="text-xs text-muted-foreground">
                                  ({employee.current_tasks_count} tasks)
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button onClick={handleCreateTask} className="flex-1">
                      Create Task
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
            {tasks.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No tasks found</p>
                <p className="text-sm">Create your first task to get started</p>
              </div>
            ) : (
              tasks.map((task) => (
                <div key={task.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold">{task.title}</h3>
                        <Badge className={getPriorityColor(task.priority)}>
                          {task.priority}
                        </Badge>
                        <Badge className={getStatusColor(task.status)}>
                          {task.status.replace('_', ' ')}
                        </Badge>
                        {task.due_date && isOverdue(task.due_date) && (
                          <Badge variant="destructive">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Overdue
                          </Badge>
                        )}
                      </div>
                      
                      {task.description && (
                        <p className="text-sm text-muted-foreground mb-3">{task.description}</p>
                      )}
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {task.project?.name || 'No Project'}
                        </div>
                        {task.assignee && (
                          <div className="flex items-center gap-1">
                            <Avatar className="w-4 h-4">
                              <AvatarImage src={task.assignee.avatar_url || undefined} />
                              <AvatarFallback className="text-xs">
                                {task.assignee.full_name.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            {task.assignee.full_name}
                          </div>
                        )}
                        {task.due_date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Due {new Date(task.due_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Select
                        value={task.status}
                        onValueChange={(value: TaskStatus) => handleUpdateTaskStatus(task.id, value)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todo">To Do</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="in_review">In Review</SelectItem>
                          <SelectItem value="done">Done</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteTask(task.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
