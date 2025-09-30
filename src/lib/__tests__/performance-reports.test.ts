import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPerformanceReportHandlers } from '../performance-reports';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        in: vi.fn(() => Promise.resolve({ 
          data: [
            {
              user_id: 'user-1',
              role: 'employee',
              users: {
                id: 'user-1',
                full_name: 'Test User',
                email: 'test@example.com'
              }
            }
          ], 
          error: null 
        })),
        gte: vi.fn(() => ({
          lte: vi.fn(() => Promise.resolve({ 
            data: [
              {
                id: 'task-1',
                status: 'done',
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-02T00:00:00Z',
                due_date: '2024-01-03T00:00:00Z',
                project: { organization_id: 'test-org-id' }
              }
            ], 
            error: null 
          }))
        }))
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

// Mock window.URL and document for CSV export
Object.defineProperty(window, 'URL', {
  value: {
    createObjectURL: vi.fn(() => 'mock-url'),
    revokeObjectURL: vi.fn()
  }
});

Object.defineProperty(document, 'createElement', {
  value: vi.fn(() => ({
    href: '',
    download: '',
    click: vi.fn()
  }))
});

describe('Performance Reports Handlers', () => {
  const organizationId = 'test-org-id';
  const currentUserId = 'test-user-id';
  const currentUserRole = 'admin' as const;
  
  let handlers: ReturnType<typeof createPerformanceReportHandlers>;

  beforeEach(() => {
    vi.clearAllMocks();
    handlers = createPerformanceReportHandlers(organizationId, currentUserId, currentUserRole, mockToast);
  });

  describe('getUserPerformance', () => {
    it('should get user performance metrics', async () => {
      const startDate = '2024-01-01T00:00:00Z';
      const endDate = '2024-01-31T23:59:59Z';

      const metrics = await handlers.getUserPerformance(startDate, endDate);
      
      expect(Array.isArray(metrics)).toBe(true);
      if (metrics.length > 0) {
        expect(metrics[0]).toHaveProperty('userId');
        expect(metrics[0]).toHaveProperty('userName');
        expect(metrics[0]).toHaveProperty('userEmail');
        expect(metrics[0]).toHaveProperty('userRole');
        expect(metrics[0]).toHaveProperty('tasksCompleted');
        expect(metrics[0]).toHaveProperty('averageLeadTime');
        expect(metrics[0]).toHaveProperty('averageCycleTime');
        expect(metrics[0]).toHaveProperty('onTimeDeliveryRate');
        expect(metrics[0]).toHaveProperty('totalLoggedHours');
        expect(metrics[0]).toHaveProperty('focusRatio');
      }
    });

    it('should handle errors gracefully', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: vi.fn(() => Promise.resolve({ data: null, error: new Error('Database error') }))
          }))
        }))
      });

      const metrics = await handlers.getUserPerformance('2024-01-01T00:00:00Z', '2024-01-31T23:59:59Z');
      
      expect(metrics).toEqual([]);
      expect(mockToast).toHaveBeenCalledWith({
        title: "Error",
        description: "Failed to get user performance data",
        variant: "destructive",
      });
    });
  });

  describe('getProjectPerformance', () => {
    it('should get project performance metrics', async () => {
      const startDate = '2024-01-01T00:00:00Z';
      const endDate = '2024-01-31T23:59:59Z';

      const metrics = await handlers.getProjectPerformance(startDate, endDate);
      
      expect(Array.isArray(metrics)).toBe(true);
      if (metrics.length > 0) {
        expect(metrics[0]).toHaveProperty('projectId');
        expect(metrics[0]).toHaveProperty('projectName');
        expect(metrics[0]).toHaveProperty('completionRate');
        expect(metrics[0]).toHaveProperty('overdueTasks');
        expect(metrics[0]).toHaveProperty('nearingDueTasks');
        expect(metrics[0]).toHaveProperty('averageCycleTime');
        expect(metrics[0]).toHaveProperty('throughput');
        expect(metrics[0]).toHaveProperty('wip');
        expect(metrics[0]).toHaveProperty('slaBreachRate');
      }
    });
  });

  describe('generateReport', () => {
    it('should generate a comprehensive report', async () => {
      const filters = {
        startDate: '2024-01-01T00:00:00Z',
        endDate: '2024-01-31T23:59:59Z',
      };

      const report = await handlers.generateReport(filters);
      
      expect(report).toHaveProperty('userMetrics');
      expect(report).toHaveProperty('projectMetrics');
      expect(report).toHaveProperty('teamMetrics');
      expect(Array.isArray(report.userMetrics)).toBe(true);
      expect(Array.isArray(report.projectMetrics)).toBe(true);
      expect(Array.isArray(report.teamMetrics)).toBe(true);
    });
  });

  describe('exportToCSV', () => {
    it('should export data to CSV', () => {
      const testData = [
        { name: 'Test User', email: 'test@example.com', score: 95 },
        { name: 'Another User', email: 'another@example.com', score: 87 }
      ];

      handlers.exportToCSV(testData, 'test-export');
      
      expect(mockToast).toHaveBeenCalledWith({
        title: "Export Complete",
        description: "Data exported to test-export.csv",
      });
    });

    it('should handle empty data gracefully', () => {
      handlers.exportToCSV([], 'empty-export');
      
      expect(mockToast).toHaveBeenCalledWith({
        title: "No Data",
        description: "No data to export",
        variant: "destructive",
      });
    });
  });
});
