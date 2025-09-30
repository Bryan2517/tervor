import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type UserRole = "owner" | "admin" | "supervisor" | "employee";

interface UserManagementHandlers {
  handleInviteUser: (email: string, role: UserRole, expiresAtISO: string) => Promise<void>;
  handleChangeOrgRole: (userId: string, role: UserRole) => Promise<void>;
  handleRemoveUserFromOrg: (userId: string) => Promise<void>;
  handleTransferOrgOwnership: (newOwnerUserId: string) => Promise<void>;
}

export const createUserManagementHandlers = (
  organizationId: string,
  currentUserId: string,
  currentUserRole: UserRole,
  toast: ReturnType<typeof useToast>["toast"]
): UserManagementHandlers => {
  
  const handleInviteUser = async (email: string, role: UserRole, expiresAtISO: string) => {
    try {
      // Check if user can invite this role
      const canInvite = canInviteRole(currentUserRole, role);
      if (!canInvite) {
        toast({
          title: "Permission Denied",
          description: "You don't have permission to invite users with this role",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('org_invites')
        .insert({
          organization_id: organizationId,
          role,
          email: email || null,
          expires_at: expiresAtISO,
        });

      if (error) throw error;

      toast({
        title: "Invitation Sent",
        description: `Invitation sent to ${email || 'user'}`,
      });
    } catch (error) {
      console.error('Error inviting user:', error);
      toast({
        title: "Error",
        description: "Failed to send invitation",
        variant: "destructive",
      });
    }
  };

  const handleChangeOrgRole = async (userId: string, role: UserRole) => {
    try {
      // Check if user can change to this role
      const canChange = canChangeRole(currentUserRole, role);
      if (!canChange) {
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
      console.error('Error changing role:', error);
      toast({
        title: "Error",
        description: "Failed to update user role",
        variant: "destructive",
      });
    }
  };

  const handleRemoveUserFromOrg = async (userId: string) => {
    try {
      // Prevent removing the last owner
      const { data: owners } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', organizationId)
        .eq('role', 'owner');

      if (owners && owners.length === 1 && owners[0].user_id === userId) {
        toast({
          title: "Cannot Remove",
          description: "Cannot remove the last owner of the organization",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('organization_id', organizationId)
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "User Removed",
        description: "User has been removed from the organization",
      });
    } catch (error) {
      console.error('Error removing user:', error);
      toast({
        title: "Error",
        description: "Failed to remove user from organization",
        variant: "destructive",
      });
    }
  };

  const handleTransferOrgOwnership = async (newOwnerUserId: string) => {
    try {
      // Only owners can transfer ownership
      if (currentUserRole !== 'owner') {
        toast({
          title: "Permission Denied",
          description: "Only owners can transfer organization ownership",
          variant: "destructive",
        });
        return;
      }

      // Cannot transfer to self
      if (newOwnerUserId === currentUserId) {
        toast({
          title: "Invalid Transfer",
          description: "Cannot transfer ownership to yourself",
          variant: "destructive",
        });
        return;
      }

      // Check if new owner is a member of the organization
      const { data: member } = await supabase
        .from('organization_members')
        .select('user_id')
        .eq('organization_id', organizationId)
        .eq('user_id', newOwnerUserId)
        .single();

      if (!member) {
        toast({
          title: "Invalid User",
          description: "The selected user is not a member of this organization",
          variant: "destructive",
        });
        return;
      }

      // Update organization owner
      const { error: orgError } = await supabase
        .from('organizations')
        .update({ created_by: newOwnerUserId })
        .eq('id', organizationId);

      if (orgError) throw orgError;

      // Update new owner's role
      const { error: newOwnerError } = await supabase
        .from('organization_members')
        .update({ role: 'owner' })
        .eq('organization_id', organizationId)
        .eq('user_id', newOwnerUserId);

      if (newOwnerError) throw newOwnerError;

      // Update current owner's role to admin
      const { error: currentOwnerError } = await supabase
        .from('organization_members')
        .update({ role: 'admin' })
        .eq('organization_id', organizationId)
        .eq('user_id', currentUserId);

      if (currentOwnerError) throw currentOwnerError;

      toast({
        title: "Ownership Transferred",
        description: "Organization ownership has been transferred successfully",
      });
    } catch (error) {
      console.error('Error transferring ownership:', error);
      toast({
        title: "Error",
        description: "Failed to transfer organization ownership",
        variant: "destructive",
      });
    }
  };

  return {
    handleInviteUser,
    handleChangeOrgRole,
    handleRemoveUserFromOrg,
    handleTransferOrgOwnership,
  };
};

// Helper functions for role management
const canInviteRole = (userRole: UserRole, targetRole: UserRole): boolean => {
  const hierarchy = { owner: 4, admin: 3, supervisor: 2, employee: 1 };
  const userLevel = hierarchy[userRole];
  const targetLevel = hierarchy[targetRole];
  
  return userLevel >= targetLevel;
};

const canChangeRole = (userRole: UserRole, targetRole: UserRole): boolean => {
  const hierarchy = { owner: 4, admin: 3, supervisor: 2, employee: 1 };
  const userLevel = hierarchy[userRole];
  const targetLevel = hierarchy[targetRole];
  
  return userLevel >= targetLevel;
};
