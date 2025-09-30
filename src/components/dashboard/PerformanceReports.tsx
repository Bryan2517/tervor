import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/enhanced-card";
import { Button } from "@/components/ui/enhanced-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { createPerformanceReportHandlers } from "@/lib/performance-reports";
import { 
  TrendingUp, 
  Download, 
  Calendar,
  Users,
  Building2,
  Target,
  Clock,
  BarChart3
} from "lucide-react";

type UserRole = "owner" | "admin" | "supervisor" | "employee";

interface PerformanceMetrics {
  userId: string;
  userName: string;
  userEmail: string;
  userRole: UserRole;
  tasksCompleted: number;
  averageLeadTime: number;
  averageCycleTime: number;
  onTimeDeliveryRate: number;
  totalLoggedHours: number;
  focusRatio: number;
}

interface ProjectMetrics {
  projectId: string;
  projectName: string;
  completionRate: number;
  overdueTasks: number;
  nearingDueTasks: number;
  averageCycleTime: number;
  throughput: number;
  wip: number;
  slaBreachRate: number;
}

interface PerformanceReportsProps {
  organizationId: string;
  currentUserId: string;
  currentUserRole: UserRole;
}

export function PerformanceReports({ organizationId, currentUserId, currentUserRole }: PerformanceReportsProps) {
  const [userMetrics, setUserMetrics] = useState<PerformanceMetrics[]>([]);
  const [projectMetrics, setProjectMetrics] = useState<ProjectMetrics[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
    endDate: new Date().toISOString().split('T')[0], // today
    reportType: 'all' as 'all' | 'users' | 'projects' | 'teams',
  });
  const { toast } = useToast();

  const performanceReports = createPerformanceReportHandlers(organizationId, currentUserId, currentUserRole, toast);

  const generateReport = async () => {
    setLoading(true);
    try {
      const report = await performanceReports.generateReport({
        startDate: new Date(filters.startDate).toISOString(),
        endDate: new Date(filters.endDate).toISOString(),
      });

      setUserMetrics(report.userMetrics);
      setProjectMetrics(report.projectMetrics);
    } catch (error) {
      console.error('Error generating report:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportUserMetrics = () => {
    performanceReports.exportToCSV(userMetrics, 'user-performance-report');
  };

  const exportProjectMetrics = () => {
    performanceReports.exportToCSV(projectMetrics, 'project-performance-report');
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'owner':
        return '👑';
      case 'admin':
        return '🛡️';
      case 'supervisor':
        return '👥';
      case 'employee':
        return '👤';
      default:
        return '👤';
    }
  };

  const getPerformanceBadge = (rate: number, type: 'delivery' | 'completion') => {
    const threshold = type === 'delivery' ? 80 : 70;
    if (rate >= threshold) return <Badge className="bg-green-100 text-green-800">Excellent</Badge>;
    if (rate >= threshold - 20) return <Badge className="bg-yellow-100 text-yellow-800">Good</Badge>;
    return <Badge className="bg-red-100 text-red-800">Needs Improvement</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Performance Reports
          </CardTitle>
          <CardDescription>
            Generate and export performance metrics for users and projects
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="reportType">Report Type</Label>
              <Select 
                value={filters.reportType} 
                onValueChange={(value: 'all' | 'users' | 'projects' | 'teams') => 
                  setFilters(prev => ({ ...prev, reportType: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Metrics</SelectItem>
                  <SelectItem value="users">User Performance</SelectItem>
                  <SelectItem value="projects">Project Performance</SelectItem>
                  <SelectItem value="teams">Team Performance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-end">
              <Button onClick={generateReport} disabled={loading} className="w-full">
                {loading ? "Generating..." : "Generate Report"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Performance Metrics */}
      {(filters.reportType === 'all' || filters.reportType === 'users') && userMetrics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                User Performance Metrics
              </div>
              <Button variant="outline" size="sm" onClick={exportUserMetrics}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </CardTitle>
          </CardHeader>
          
          <CardContent>
            <div className="space-y-4">
              {userMetrics.map((user) => (
                <div key={user.userId} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{getRoleIcon(user.userRole)}</span>
                      <div>
                        <div className="font-medium">{user.userName}</div>
                        <div className="text-sm text-muted-foreground">{user.userEmail}</div>
                      </div>
                      <Badge variant="outline">{user.userRole}</Badge>
                    </div>
                    {getPerformanceBadge(user.onTimeDeliveryRate, 'delivery')}
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-blue-500" />
                      <div>
                        <div className="font-medium">{user.tasksCompleted}</div>
                        <div className="text-muted-foreground">Tasks Completed</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-green-500" />
                      <div>
                        <div className="font-medium">{user.averageLeadTime}d</div>
                        <div className="text-muted-foreground">Avg Lead Time</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-purple-500" />
                      <div>
                        <div className="font-medium">{user.averageCycleTime}d</div>
                        <div className="text-muted-foreground">Avg Cycle Time</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-orange-500" />
                      <div>
                        <div className="font-medium">{user.onTimeDeliveryRate}%</div>
                        <div className="text-muted-foreground">On-Time Delivery</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-500" />
                      <div>
                        <div className="font-medium">{user.totalLoggedHours}h</div>
                        <div className="text-muted-foreground">Total Logged Hours</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-pink-500" />
                      <div>
                        <div className="font-medium">{Math.round(user.focusRatio * 100)}%</div>
                        <div className="text-muted-foreground">Focus Ratio</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Project Performance Metrics */}
      {(filters.reportType === 'all' || filters.reportType === 'projects') && projectMetrics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Project Performance Metrics
              </div>
              <Button variant="outline" size="sm" onClick={exportProjectMetrics}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </CardTitle>
          </CardHeader>
          
          <CardContent>
            <div className="space-y-4">
              {projectMetrics.map((project) => (
                <div key={project.projectId} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Building2 className="w-5 h-5 text-blue-500" />
                      <div>
                        <div className="font-medium">{project.projectName}</div>
                      </div>
                    </div>
                    {getPerformanceBadge(project.completionRate, 'completion')}
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-blue-500" />
                      <div>
                        <div className="font-medium">{project.completionRate}%</div>
                        <div className="text-muted-foreground">Completion Rate</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <div>
                        <div className="font-medium">{project.overdueTasks}</div>
                        <div className="text-muted-foreground">Overdue Tasks</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-yellow-500" />
                      <div>
                        <div className="font-medium">{project.nearingDueTasks}</div>
                        <div className="text-muted-foreground">Due Soon</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-500" />
                      <div>
                        <div className="font-medium">{project.averageCycleTime}d</div>
                        <div className="text-muted-foreground">Avg Cycle Time</div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-purple-500" />
                      <div>
                        <div className="font-medium">{project.throughput}</div>
                        <div className="text-muted-foreground">Tasks/Week</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-indigo-500" />
                      <div>
                        <div className="font-medium">{project.wip}</div>
                        <div className="text-muted-foreground">Work in Progress</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {userMetrics.length === 0 && projectMetrics.length === 0 && !loading && (
        <Card>
          <CardContent className="text-center py-6">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">No performance data available</p>
            <p className="text-sm text-muted-foreground">Generate a report to see metrics</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
