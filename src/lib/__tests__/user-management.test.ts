import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createUserManagementHandlers } from '../user-management';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => ({
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: { id: 'test-invite-id' }, error: null }))
      }))
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null }))
      }))
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null }))
      }))
    }))
  }))
};

// Mock the supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: mockSupabase
}));

// Mock toast
const mockToast = vi.fn();

describe('User Management Handlers', () => {
  const organizationId = 'test-org-id';
  const currentUserId = 'test-user-id';
  const currentUserRole = 'admin' as const;
  
  let handlers: ReturnType<typeof createUserManagementHandlers>;

  beforeEach(() => {
    vi.clearAllMocks();
    handlers = createUserManagementHandlers(organizationId, currentUserId, currentUserRole, mockToast);
  });

  describe('handleInviteUser', () => {
    it('should invite a user with valid role', async () => {
      await handlers.handleInviteUser('test@example.com', 'employee', '2024-12-31T23:59:59Z');
      
      expect(mockSupabase.from).toHaveBeenCalledWith('org_invites');
      expect(mockToast).toHaveBeenCalledWith({
        title: "Invitation Sent",
        description: "Invitation sent to test@example.com",
      });
    });

    it('should prevent inviting users with higher roles', async () => {
      await handlers.handleInviteUser('test@example.com', 'owner', '2024-12-31T23:59:59Z');
      
      expect(mockToast).toHaveBeenCalledWith({
        title: "Permission Denied",
        description: "You don't have permission to invite users with this role",
        variant: "destructive",
      });
    });
  });

  describe('handleChangeOrgRole', () => {
    it('should change user role successfully', async () => {
      await handlers.handleChangeOrgRole('target-user-id', 'employee');
      
      expect(mockSupabase.from).toHaveBeenCalledWith('organization_members');
      expect(mockToast).toHaveBeenCalledWith({
        title: "Role Updated",
        description: "User role has been updated successfully",
      });
    });

    it('should prevent changing to higher roles', async () => {
      await handlers.handleChangeOrgRole('target-user-id', 'owner');
      
      expect(mockToast).toHaveBeenCalledWith({
        title: "Permission Denied",
        description: "You don't have permission to assign this role",
        variant: "destructive",
      });
    });
  });

  describe('handleRemoveUserFromOrg', () => {
    it('should remove user from organization', async () => {
      await handlers.handleRemoveUserFromOrg('target-user-id');
      
      expect(mockSupabase.from).toHaveBeenCalledWith('organization_members');
      expect(mockToast).toHaveBeenCalledWith({
        title: "User Removed",
        description: "User has been removed from the organization",
      });
    });
  });

  describe('handleTransferOrgOwnership', () => {
    it('should transfer ownership successfully', async () => {
      // Mock the member check
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: { user_id: 'new-owner-id' }, error: null }))
            }))
          }))
        }))
      });

      await handlers.handleTransferOrgOwnership('new-owner-id');
      
      expect(mockSupabase.from).toHaveBeenCalledWith('organizations');
      expect(mockToast).toHaveBeenCalledWith({
        title: "Ownership Transferred",
        description: "Organization ownership has been transferred successfully",
      });
    });

    it('should prevent transferring to self', async () => {
      await handlers.handleTransferOrgOwnership(currentUserId);
      
      expect(mockToast).toHaveBeenCalledWith({
        title: "Invalid Transfer",
        description: "Cannot transfer ownership to yourself",
        variant: "destructive",
      });
    });
  });
});
