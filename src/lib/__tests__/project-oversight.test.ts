import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createProjectOversightHandlers } from '../project-oversight';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => ({
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ 
          data: { 
            id: 'test-project-id', 
            name: 'Test Project',
            description: 'Test Description',
            organization_id: 'test-org-id',
            owner_id: 'test-user-id',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
          }, 
          error: null 
        }))
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
    })),
    upsert: vi.fn(() => ({
      onConflict: vi.fn(() => Promise.resolve({ error: null }))
    })),
    select: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ 
        data: [
          { id: 'task-1', status: 'done', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-02T00:00:00Z', due_date: '2024-01-03T00:00:00Z' },
          { id: 'task-2', status: 'in_progress', created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z', due_date: '2024-01-05T00:00:00Z' }
        ], 
        error: null 
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

describe('Project Oversight Handlers', () => {
  const organizationId = 'test-org-id';
  const currentUserId = 'test-user-id';
  const currentUserRole = 'admin' as const;
  
  let handlers: ReturnType<typeof createProjectOversightHandlers>;

  beforeEach(() => {
    vi.clearAllMocks();
    handlers = createProjectOversightHandlers(organizationId, currentUserId, currentUserRole, mockToast);
  });

  describe('handleCreateProject', () => {
    it('should create a project successfully', async () => {
      const projectInput = {
        name: 'Test Project',
        description: 'Test Description',
      };

      const result = await handlers.handleCreateProject(projectInput);
      
      expect(result).toBeTruthy();
      expect(result?.name).toBe('Test Project');
      expect(mockSupabase.from).toHaveBeenCalledWith('projects');
      expect(mockToast).toHaveBeenCalledWith({
        title: "Project Created",
        description: "Project \"Test Project\" has been created successfully",
      });
    });

    it('should prevent non-admin users from creating projects', async () => {
      const employeeHandlers = createProjectOversightHandlers(organizationId, currentUserId, 'employee', mockToast);
      
      const result = await employeeHandlers.handleCreateProject({
        name: 'Test Project',
        description: 'Test Description',
      });
      
      expect(result).toBeNull();
      expect(mockToast).toHaveBeenCalledWith({
        title: "Permission Denied",
        description: "Only owners and admins can create projects",
        variant: "destructive",
      });
    });
  });

  describe('handleUpdateProject', () => {
    it('should update a project successfully', async () => {
      await handlers.handleUpdateProject('project-id', { name: 'Updated Project' });
      
      expect(mockSupabase.from).toHaveBeenCalledWith('projects');
      expect(mockToast).toHaveBeenCalledWith({
        title: "Project Updated",
        description: "Project has been updated successfully",
      });
    });
  });

  describe('handleArchiveProject', () => {
    it('should archive a project successfully', async () => {
      await handlers.handleArchiveProject('project-id');
      
      expect(mockSupabase.from).toHaveBeenCalledWith('projects');
      expect(mockToast).toHaveBeenCalledWith({
        title: "Project Archived",
        description: "Project has been archived successfully",
      });
    });
  });

  describe('handleAssignProjectMember', () => {
    it('should assign a project member successfully', async () => {
      // Mock organization member check
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: { user_id: 'member-id' }, error: null }))
            }))
          }))
        }))
      });

      await handlers.handleAssignProjectMember('project-id', 'member-id', 'employee');
      
      expect(mockSupabase.from).toHaveBeenCalledWith('project_members');
      expect(mockToast).toHaveBeenCalledWith({
        title: "Member Added",
        description: "User has been added to the project",
      });
    });

    it('should prevent assigning non-organization members', async () => {
      // Mock organization member check to return null
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: null, error: null }))
            }))
          }))
        }))
      });

      await handlers.handleAssignProjectMember('project-id', 'non-member-id', 'employee');
      
      expect(mockToast).toHaveBeenCalledWith({
        title: "Invalid User",
        description: "User must be a member of the organization first",
        variant: "destructive",
      });
    });
  });

  describe('handleRemoveProjectMember', () => {
    it('should remove a project member successfully', async () => {
      await handlers.handleRemoveProjectMember('project-id', 'member-id');
      
      expect(mockSupabase.from).toHaveBeenCalledWith('project_members');
      expect(mockToast).toHaveBeenCalledWith({
        title: "Member Removed",
        description: "User has been removed from the project",
      });
    });
  });

  describe('getProjectHealth', () => {
    it('should calculate project health correctly', async () => {
      const health = await handlers.getProjectHealth('project-id');
      
      expect(health).toHaveProperty('health');
      expect(health).toHaveProperty('completionRate');
      expect(health).toHaveProperty('overdueTasks');
      expect(health).toHaveProperty('nearingDueTasks');
      expect(health).toHaveProperty('averageCycleTime');
      expect(['Good', 'At Risk', 'Blocked']).toContain(health.health);
    });
  });
});
