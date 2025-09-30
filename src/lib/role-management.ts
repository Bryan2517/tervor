import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type UserRole = "owner" | "admin" | "supervisor" | "employee";

interface RoleManagementHandlers {
  handleSetOrgRole: (userId: string, role: UserRole) => Promise<void>;
  handleSetProjectRole: (projectId: string, userId: string, role: UserRole) => Promise<void>;
  canManageRole: (targetRole: UserRole) => boolean;
  canManageProjectRole: (projectId: string, targetRole: UserRole) => Promise<boolean>;
}

export const createRoleManagementHandlers = (
  organizationId: string,
  currentUserId: string,
  currentUserRole: UserRole,
  toast: ReturnType<typeof useToast>["toast"]
): RoleManagementHandlers => {

  const handleSetOrgRole = async (userId: string, role: UserRole) => {
    try {
      // Check if user can manage this role
      if (!canManageRole(role)) {
        toast({
          title: "Permission Denied",
          description: "You don't have permission to assign this role",
          variant: "destructive",
        });
        return;
      }

      // Prevent demoting the last owner
      if (role !== 'owner') {
        const { data: owners } = await supabase
          .from('organization_members')
          .select('user_id')
          .eq('organization_id', organizationId)
          .eq('role', 'owner');

        if (owners && owners.length === 1 && owners[0].user_id === userId) {
          toast({
            title: "Cannot Demote",
            description: "Cannot demote the last owner of the organization",
            variant: "destructive",
          });
          return;
        }
      }

      // Check if user is trying to change their own role
      if (userId === currentUserId && role !== currentUserRole) {
        toast({
          title: "Cannot Change Own Role",
          description: "You cannot change your own role",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('organization_members')
        .update({ role })
        .eq('organization_id', organizationId)
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "Role Updated",
        description: "User role has been updated successfully",
      });
    } catch (error) {
      console.error('Error updating org role:', error);
      toast({
        title: "Error",
        description: "Failed to update user role",
        variant: "destructive",
      });
    }
  };

  const handleSetProjectRole = async (projectId: string, userId: string, role: UserRole) => {
    try {
      // Check if user can manage project roles
      const canManage = await canManageProjectRole(projectId, role);
      if (!canManage) {
        toast({
          title: "Permission Denied",
          description: "You don't have permission to assign this project role",
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

      // Ensure at least one manager per project
      if (role !== 'supervisor') {
        const { data: managers } = await supabase
          .from('project_members')
          .select('user_id')
          .eq('project_id', projectId)
          .eq('role', 'supervisor');

        if (managers && managers.length === 1 && managers[0].user_id === userId) {
          toast({
            title: "Cannot Demote",
            description: "Cannot demote the last manager of the project",
            variant: "destructive",
          });
          return;
        }
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
        title: "Project Role Updated",
        description: "User's project role has been updated successfully",
      });
    } catch (error) {
      console.error('Error updating project role:', error);
      toast({
        title: "Error",
        description: "Failed to update project role",
        variant: "destructive",
      });
    }
  };

  const canManageRole = (targetRole: UserRole): boolean => {
    const hierarchy = { owner: 4, admin: 3, supervisor: 2, employee: 1 };
    const userLevel = hierarchy[currentUserRole];
    const targetLevel = hierarchy[targetRole];
    
    return userLevel >= targetLevel;
  };

  const canManageProjectRole = async (projectId: string, targetRole: UserRole): Promise<boolean> => {
    try {
      // Check if user is a project manager or has org-level permissions
      if (['owner', 'admin'].includes(currentUserRole)) {
        return true;
      }

      // Check if user is a project manager
      const { data: projectMember } = await supabase
        .from('project_members')
        .select('role')
        .eq('project_id', projectId)
        .eq('user_id', currentUserId)
        .single();

      if (projectMember?.role === 'supervisor') {
        // Supervisors can only assign employee roles
        return targetRole === 'employee';
      }

      return false;
    } catch (error) {
      console.error('Error checking project role permissions:', error);
      return false;
    }
  };

  return {
    handleSetOrgRole,
    handleSetProjectRole,
    canManageRole,
    canManageProjectRole,
  };
};
