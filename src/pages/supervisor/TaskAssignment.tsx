import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Target, Clock, CheckCircle2, Filter, Search, AlertCircle, Circle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

type TaskStatus = "todo" | "in_progress" | "review" | "done" | "blocked" | "overdue";
type TaskPriority = "low" | "medium" | "high";

interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date?: string;
  assignee_id?: string;
  project: {
    name: string;
  };
  assignee?: {
    full_name: string;
  };
}

export default function SupervisorTaskAssignment() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchTasks();
  }, []);

  const checkAndUpdateOverdueTasks = async (tasksData: Task[]) => {
    const now = new Date();
    const overdueTasks = tasksData.filter(task => {
      if (!task.due_date) return false;
      
      // Create date objects for comparison (ignore time portion)
      const dueDate = new Date(task.due_date);
      dueDate.setHours(0, 0, 0, 0);
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      
      return dueDate < today && 
             task.status !== 'done' && 
             task.status !== 'overdue';
    });

    // Update overdue tasks in the database
    const updatePromises = overdueTasks.map(async (task) => {
      try {
        const { error } = await supabase
          .from('tasks')
          .update({ status: 'overdue' })
          .eq('id', task.id);

        if (error) {
          console.error(`Error updating task ${task.id} to overdue:`, error);
          return null;
        } else {
          console.log(`Task ${task.id} marked as overdue`);
          return task.id;
        }
      } catch (error) {
        console.error(`Error updating task ${task.id}:`, error);
        return null;
      }
    });

    // Wait for all updates to complete
    await Promise.all(updatePromises);

    // Return updated tasks array with overdue status applied
    return tasksData.map(task => {
      if (overdueTasks.find(overdueTask => overdueTask.id === task.id)) {
        return { ...task, status: 'overdue' as TaskStatus };
      }
      return task;
    });
  };

  const fetchTasks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log("No user found");
        setLoading(false);
        return;
      }

      const { data: orgMember, error: orgError } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .eq("role", "supervisor")
        .single();

      if (orgError) {
        console.error("Error fetching organization:", orgError);
        toast({
          title: "Error",
          description: "Failed to load organization data",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (!orgMember) {
        console.log("No organization found for supervisor");
        setTasks([]);
        setLoading(false);
        return;
      }

      const { data: tasksData, error: tasksError } = await supabase
        .from("tasks")
        .select(`
          id,
          title,
          description,
          status,
          priority,
          due_date,
          assignee_id,
          project:projects!inner(name, organization_id),
          assignee:users!tasks_assignee_id_fkey(full_name)
        `)
        .eq("project.organization_id", orgMember.organization_id)
        .order("created_at", { ascending: false });

      if (tasksError) {
        console.error("Error fetching tasks:", tasksError);
        toast({
          title: "Error",
          description: "Failed to load tasks",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (tasksData) {
        // Check and update overdue tasks
        const updatedTasks = await checkAndUpdateOverdueTasks(tasksData as Task[]);
        setTasks(updatedTasks);
      } else {
        setTasks([]);
      }
    } catch (error) {
      console.error("Error in fetchTasks:", error);
      toast({
        title: "Error",
        description: "Failed to load tasks",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: TaskPriority) => {
    switch (priority) {
      case "high":
        return "destructive";
      case "medium":
        return "default";
      case "low":
        return "secondary";
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case "done": 
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
      case "in_progress": 
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
      case "todo": 
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
      case "overdue": 
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
      case "review":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
      case "blocked":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
      default: 
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const getStatusIcon = (status: TaskStatus) => {
    switch (status) {
      case "todo":
        return <Circle className="w-4 h-4 text-muted-foreground" />;
      case "in_progress":
        return <Clock className="w-4 h-4 text-blue-500" />;
      case "done":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "overdue":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case "review":
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      case "blocked":
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const filteredTasks = useMemo(() => {
    let filtered = tasks;
    
    if (filterStatus !== "all") {
      filtered = filtered.filter(t => t.status === filterStatus);
    }
    
    if (filterPriority !== "all") {
      filtered = filtered.filter(t => t.priority === filterPriority);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.project?.name.toLowerCase().includes(query) ||
        t.assignee?.full_name?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [tasks, filterStatus, filterPriority, searchQuery]);

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
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Task Assignment</h1>
              <p className="text-sm text-muted-foreground">Monitor and manage task assignments</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search tasks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Priority</label>
                <Select value={filterPriority} onValueChange={setFilterPriority}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Priorities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              All Tasks ({filteredTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredTasks.length === 0 && tasks.length > 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No tasks match your filters
                </div>
              )}
              {filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    {getStatusIcon(task.status)}
                    <div className="flex-1">
                      <p className="font-medium">{task.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">{task.project.name}</span>
                        {task.assignee && (
                          <>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-muted-foreground">
                              Assigned to {task.assignee.full_name}
                            </span>
                          </>
                        )}
                        {task.description && (
                          <>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-muted-foreground line-clamp-1">
                              {task.description}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Badge variant={getPriorityColor(task.priority)}>{task.priority}</Badge>
                    <Badge variant="outline" className={getStatusColor(task.status)}>
                      {task.status.replace("_", " ")}
                    </Badge>
                    {task.due_date && (
                      <div className={`text-sm ${
                        task.status === 'overdue' ? 'text-red-500 font-medium' : 'text-muted-foreground'
                      }`}>
                        Due: {new Date(task.due_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {tasks.length === 0 && (
                <div className="text-center py-12">
                  <Target className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No tasks found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}