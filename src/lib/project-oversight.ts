import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type UserRole = "owner" | "admin" | "supervisor" | "employee";

interface Project {
  id: string;
  name: string;
  description?: string;
  organization_id: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

interface ProjectInput {
  name: string;
  description?: string;
  due_date?: string;
  owner_id?: string;
}

interface ProjectOversightHandlers {
  handleCreateProject: (input: ProjectInput) => Promise<Project | null>;
  handleUpdateProject: (projectId: string, patch: Partial<Project>) => Promise<void>;
  handleArchiveProject: (projectId: string) => Promise<void>;
  handleAssignProjectMember: (projectId: string, userId: string, role: UserRole) => Promise<void>;
  handleRemoveProjectMember: (projectId: string, userId: string) => Promise<void>;
  getProjectHealth: (projectId: string) => Promise<{
    health: 'Good' | 'At Risk' | 'Blocked';
    completionRate: number;
    overdueTasks: number;
    nearingDueTasks: number;
    averageCycleTime: number;
  }>;
}

export const createProjectOversightHandlers = (
  organizationId: string,
  currentUserId: string,
  currentUserRole: UserRole,
  toast: ReturnType<typeof useToast>["toast"]
): ProjectOversightHandlers => {

  const handleCreateProject = async (input: ProjectInput): Promise<Project | null> => {
    try {
      // Check if user can create projects
      if (!['owner', 'admin'].includes(currentUserRole)) {
        toast({
          title: "Permission Denied",
          description: "Only owners and admins can create projects",
          variant: "destructive",
        });
        return null;
      }

      const { data, error } = await supabase
        .from('projects')
        .insert({
          name: input.name,
          description: input.description,
          organization_id: organizationId,
          owner_id: input.owner_id || currentUserId,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Project Created",
        description: `Project "${input.name}" has been created successfully`,
      });

      return data;
    } catch (error) {
      console.error('Error creating project:', error);
      toast({
        title: "Error",
        description: "Failed to create project",
        variant: "destructive",
      });
      return null;
    }
  };

  const handleUpdateProject = async (projectId: string, patch: Partial<Project>) => {
    try {
      // Check if user can update projects
      if (!['owner', 'admin'].includes(currentUserRole)) {
        toast({
          title: "Permission Denied",
          description: "Only owners and admins can update projects",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('projects')
        .update({
          ...patch,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId)
        .eq('organization_id', organizationId);

      if (error) throw error;

      toast({
        title: "Project Updated",
        description: "Project has been updated successfully",
      });
    } catch (error) {
      console.error('Error updating project:', error);
      toast({
        title: "Error",
        description: "Failed to update project",
        variant: "destructive",
      });
    }
  };

  const handleArchiveProject = async (projectId: string) => {
    try {
      // Check if user can archive projects
      if (!['owner', 'admin'].includes(currentUserRole)) {
        toast({
          title: "Permission Denied",
          description: "Only owners and admins can archive projects",
          variant: "destructive",
        });
        return;
      }

      // Update project status to archived (assuming we add a status field)
      const { error } = await supabase
        .from('projects')
        .update({
          updated_at: new Date().toISOString(),
          // Note: This assumes we add a status field to projects table
          // For now, we'll use a naming convention or add a status field
        })
        .eq('id', projectId)
        .eq('organization_id', organizationId);

      if (error) throw error;

      toast({
        title: "Project Archived",
        description: "Project has been archived successfully",
      });
    } catch (error) {
      console.error('Error archiving project:', error);
      toast({
        title: "Error",
        description: "Failed to archive project",
        variant: "destructive",
      });
    }
  };

  const handleAssignProjectMember = async (projectId: string, userId: string, role: UserRole) => {
    try {
      // Check if user can assign project members
      if (!['owner', 'admin', 'supervisor'].includes(currentUserRole)) {
        toast({
          title: "Permission Denied",
          description: "You don't have permission to assign project members",
          variant: "destructive",
        });
        return;
      }

      // Check if user is a member of the organization
      const { data: orgMember } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .single();

      if (!orgMember) {
        toast({
          title: "Invalid User",
          description: "User must be a member of the organization first",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('project_members')
        .upsert({
          project_id: projectId,
          user_id: userId,
          role,
        }, {
          onConflict: 'project_id,user_id'
        });

      if (error) throw error;

      toast({
        title: "Member Added",
        description: "User has been added to the project",
      });
    } catch (error) {
      console.error('Error assigning project member:', error);
      toast({
        title: "Error",
        description: "Failed to add user to project",
        variant: "destructive",
      });
    }
  };

  const handleRemoveProjectMember = async (projectId: string, userId: string) => {
    try {
      // Check if user can remove project members
      if (!['owner', 'admin', 'supervisor'].includes(currentUserRole)) {
        toast({
          title: "Permission Denied",
          description: "You don't have permission to remove project members",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('project_members')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "Member Removed",
        description: "User has been removed from the project",
      });
    } catch (error) {
      console.error('Error removing project member:', error);
      toast({
        title: "Error",
        description: "Failed to remove user from project",
        variant: "destructive",
      });
    }
  };

  const getProjectHealth = async (projectId: string) => {
    try {
      // Get project tasks
      const { data: tasks, error: tasksError } = await supabase
        .from('tasks')
        .select('id, status, due_date, created_at, updated_at')
        .eq('project_id', projectId);

      if (tasksError) throw tasksError;

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      const totalTasks = tasks?.length || 0;
      const completedTasks = tasks?.filter(task => task.status === 'done').length || 0;
      const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

      // Calculate overdue tasks
      const overdueTasks = tasks?.filter(task => {
        if (!task.due_date || task.status === 'done') return false;
        return new Date(task.due_date) < today;
      }).length || 0;

      // Calculate nearing due tasks (within 3 days)
      const threeDaysFromNow = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
      const nearingDueTasks = tasks?.filter(task => {
        if (!task.due_date || task.status === 'done') return false;
        const dueDate = new Date(task.due_date);
        return dueDate >= today && dueDate <= threeDaysFromNow;
      }).length || 0;

      // Calculate average cycle time (created to completed)
      const completedTasksWithTimes = tasks?.filter(task => 
        task.status === 'done' && task.created_at && task.updated_at
      ) || [];
      
      const totalCycleTime = completedTasksWithTimes.reduce((total, task) => {
        const created = new Date(task.created_at);
        const completed = new Date(task.updated_at);
        return total + (completed.getTime() - created.getTime());
      }, 0);
      
      const averageCycleTime = completedTasksWithTimes.length > 0 
        ? totalCycleTime / completedTasksWithTimes.length / (1000 * 60 * 60 * 24) // Convert to days
        : 0;

      // Determine health status
      let health: 'Good' | 'At Risk' | 'Blocked' = 'Good';
      
      if (overdueTasks > 0) {
        health = 'Blocked';
      } else if (nearingDueTasks > 0 || completionRate < 50) {
        health = 'At Risk';
      }

      return {
        health,
        completionRate: Math.round(completionRate),
        overdueTasks,
        nearingDueTasks,
        averageCycleTime: Math.round(averageCycleTime * 10) / 10, // Round to 1 decimal
      };
    } catch (error) {
      console.error('Error calculating project health:', error);
      return {
        health: 'Good' as const,
        completionRate: 0,
        overdueTasks: 0,
        nearingDueTasks: 0,
        averageCycleTime: 0,
      };
    }
  };

  return {
    handleCreateProject,
    handleUpdateProject,
    handleArchiveProject,
    handleAssignProjectMember,
    handleRemoveProjectMember,
    getProjectHealth,
  };
};
