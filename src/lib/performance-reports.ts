import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type UserRole = "owner" | "admin" | "supervisor" | "employee";

interface PerformanceMetrics {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: UserRole;
  tasksCompleted: number;
  averageLeadTime: number; // days from created to done
  averageCycleTime: number; // days from start to done
  onTimeDeliveryRate: number; // percentage
  totalLoggedHours: number;
  focusRatio: number; // task time / total active time
}

interface ProjectMetrics {
  projectId: string;
  projectName: string;
  completionRate: number;
  overdueTasks: number;
  nearingDueTasks: number;
  averageCycleTime: number;
  throughput: number; // tasks per week
  wip: number; // work in progress
  slaBreachRate: number; // percentage
}

interface PerformanceReportHandlers {
  getUserPerformance: (startDate: string, endDate: string, userId?: string) => Promise<PerformanceMetrics[]>;
  getProjectPerformance: (startDate: string, endDate: string, projectId?: string) => Promise<ProjectMetrics[]>;
  getTeamPerformance: (startDate: string, endDate: string) => Promise<PerformanceMetrics[]>;
  generateReport: (filters: {
    startDate: string;
    endDate: string;
    userId?: string;
    projectId?: string;
    teamId?: string;
  }) => Promise<{
    userMetrics: PerformanceMetrics[];
    projectMetrics: ProjectMetrics[];
    teamMetrics: PerformanceMetrics[];
  }>;
  exportToCSV: (data: any[], filename: string) => void;
}

export const createPerformanceReportHandlers = (
  organizationId: string,
  currentUserId: string,
  currentUserRole: UserRole,
  toast: ReturnType<typeof useToast>["toast"]
): PerformanceReportHandlers => {

  const getUserPerformance = async (startDate: string, endDate: string, userId?: string): Promise<PerformanceMetrics[]> => {
    try {
      // Get users in the organization
      const { data: users, error: usersError } = await supabase
        .from('organization_members')
        .select(`
          user_id,
          role,
          users!inner(
            id,
            full_name,
            email
          )
        `)
        .eq('organization_id', organizationId)
        .in('user_id', userId ? [userId] : undefined);

      if (usersError) throw usersError;

      const metrics: PerformanceMetrics[] = [];

      for (const user of users || []) {
        const userId = user.user_id;
        
        // Get completed tasks in date range
        const { data: completedTasks, error: tasksError } = await supabase
          .from('tasks')
          .select('id, created_at, updated_at, due_date, project:projects!inner(organization_id)')
          .eq('project.organization_id', organizationId)
          .eq('assignee_id', userId)
          .eq('status', 'done')
          .gte('updated_at', startDate)
          .lte('updated_at', endDate);

        if (tasksError) throw tasksError;

        // Get time logs for the user
        const { data: timeLogs, error: timeLogsError } = await supabase
          .from('time_logs')
          .select('duration, task_id, tasks!inner(project:projects!inner(organization_id))')
          .eq('tasks.project.organization_id', organizationId)
          .eq('user_id', userId)
          .gte('timestamp', startDate)
          .lte('timestamp', endDate);

        if (timeLogsError) throw timeLogsError;

        // Calculate metrics
        const tasksCompleted = completedTasks?.length || 0;
        
        // Calculate average lead time (created to done)
        const leadTimes = completedTasks?.map(task => {
          const created = new Date(task.created_at);
          const completed = new Date(task.updated_at);
          return (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
        }) || [];
        const averageLeadTime = leadTimes.length > 0 
          ? leadTimes.reduce((sum, time) => sum + time, 0) / leadTimes.length 
          : 0;

        // Calculate average cycle time (assuming we track start time in time_logs)
        const cycleTimes = completedTasks?.map(task => {
          const taskTimeLogs = timeLogs?.filter(log => log.task_id === task.id) || [];
          if (taskTimeLogs.length === 0) return 0;
          
          const startTime = Math.min(...taskTimeLogs.map(log => new Date(log.timestamp).getTime()));
          const endTime = new Date(task.updated_at).getTime();
          return (endTime - startTime) / (1000 * 60 * 60 * 24);
        }).filter(time => time > 0) || [];
        
        const averageCycleTime = cycleTimes.length > 0 
          ? cycleTimes.reduce((sum, time) => sum + time, 0) / cycleTimes.length 
          : 0;

        // Calculate on-time delivery rate
        const onTimeTasks = completedTasks?.filter(task => {
          if (!task.due_date) return true;
          const dueDate = new Date(task.due_date);
          const completedDate = new Date(task.updated_at);
          return completedDate <= dueDate;
        }).length || 0;
        const onTimeDeliveryRate = tasksCompleted > 0 ? (onTimeTasks / tasksCompleted) * 100 : 0;

        // Calculate total logged hours
        const totalLoggedHours = timeLogs?.reduce((total, log) => total + (log.duration || 0), 0) / 3600 || 0; // Convert seconds to hours

        // Calculate focus ratio (simplified - task time / total time)
        const focusRatio = totalLoggedHours > 0 ? Math.min(totalLoggedHours / (totalLoggedHours * 1.2), 1) : 0;

        metrics.push({
          userId,
          userName: user.users.full_name || 'Unknown',
          userEmail: user.users.email || '',
          userRole: user.role,
          tasksCompleted,
          averageLeadTime: Math.round(averageLeadTime * 10) / 10,
          averageCycleTime: Math.round(averageCycleTime * 10) / 10,
          onTimeDeliveryRate: Math.round(onTimeDeliveryRate * 10) / 10,
          totalLoggedHours: Math.round(totalLoggedHours * 10) / 10,
          focusRatio: Math.round(focusRatio * 100) / 100,
        });
      }

      return metrics;
    } catch (error) {
      console.error('Error getting user performance:', error);
      toast({
        title: "Error",
        description: "Failed to get user performance data",
        variant: "destructive",
      });
      return [];
    }
  };

  const getProjectPerformance = async (startDate: string, endDate: string, projectId?: string): Promise<ProjectMetrics[]> => {
    try {
      // Get projects in the organization
      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id, name')
        .eq('organization_id', organizationId)
        .in('id', projectId ? [projectId] : undefined);

      if (projectsError) throw projectsError;

      const metrics: ProjectMetrics[] = [];

      for (const project of projects || []) {
        const projId = project.id;
        
        // Get all tasks for the project
        const { data: allTasks, error: allTasksError } = await supabase
          .from('tasks')
          .select('id, status, created_at, updated_at, due_date')
          .eq('project_id', projId);

        if (allTasksError) throw allTasksError;

        // Get tasks in date range
        const { data: tasksInRange, error: tasksError } = await supabase
          .from('tasks')
          .select('id, status, created_at, updated_at, due_date')
          .eq('project_id', projId)
          .gte('created_at', startDate)
          .lte('created_at', endDate);

        if (tasksError) throw tasksError;

        const totalTasks = allTasks?.length || 0;
        const completedTasks = allTasks?.filter(task => task.status === 'done').length || 0;
        const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

        // Calculate overdue tasks
        const now = new Date();
        const overdueTasks = allTasks?.filter(task => {
          if (!task.due_date || task.status === 'done') return false;
          return new Date(task.due_date) < now;
        }).length || 0;

        // Calculate nearing due tasks (within 3 days)
        const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
        const nearingDueTasks = allTasks?.filter(task => {
          if (!task.due_date || task.status === 'done') return false;
          const dueDate = new Date(task.due_date);
          return dueDate >= now && dueDate <= threeDaysFromNow;
        }).length || 0;

        // Calculate average cycle time
        const completedTasksWithTimes = allTasks?.filter(task => 
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

        // Calculate throughput (tasks per week)
        const start = new Date(startDate);
        const end = new Date(endDate);
        const weeks = Math.max(1, (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7));
        const throughput = tasksInRange?.length || 0 / weeks;

        // Calculate WIP (work in progress)
        const wip = allTasks?.filter(task => 
          ['todo', 'in_progress', 'in_review'].includes(task.status)
        ).length || 0;

        // Calculate SLA breach rate (simplified)
        const slaBreachRate = totalTasks > 0 ? (overdueTasks / totalTasks) * 100 : 0;

        metrics.push({
          projectId: projId,
          projectName: project.name,
          completionRate: Math.round(completionRate * 10) / 10,
          overdueTasks,
          nearingDueTasks,
          averageCycleTime: Math.round(averageCycleTime * 10) / 10,
          throughput: Math.round(throughput * 10) / 10,
          wip,
          slaBreachRate: Math.round(slaBreachRate * 10) / 10,
        });
      }

      return metrics;
    } catch (error) {
      console.error('Error getting project performance:', error);
      toast({
        title: "Error",
        description: "Failed to get project performance data",
        variant: "destructive",
      });
      return [];
    }
  };

  const getTeamPerformance = async (startDate: string, endDate: string): Promise<PerformanceMetrics[]> => {
    return getUserPerformance(startDate, endDate);
  };

  const generateReport = async (filters: {
    startDate: string;
    endDate: string;
    userId?: string;
    projectId?: string;
    teamId?: string;
  }) => {
    try {
      const [userMetrics, projectMetrics, teamMetrics] = await Promise.all([
        getUserPerformance(filters.startDate, filters.endDate, filters.userId),
        getProjectPerformance(filters.startDate, filters.endDate, filters.projectId),
        getTeamPerformance(filters.startDate, filters.endDate),
      ]);

      return {
        userMetrics,
        projectMetrics,
        teamMetrics,
      };
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: "Error",
        description: "Failed to generate performance report",
        variant: "destructive",
      });
      return {
        userMetrics: [],
        projectMetrics: [],
        teamMetrics: [],
      };
    }
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (data.length === 0) {
      toast({
        title: "No Data",
        description: "No data to export",
        variant: "destructive",
      });
      return;
    }

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',') ? `"${value}"` : value;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: `Data exported to ${filename}.csv`,
    });
  };

  return {
    getUserPerformance,
    getProjectPerformance,
    getTeamPerformance,
    generateReport,
    exportToCSV,
  };
};
