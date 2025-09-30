import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/enhanced-card";
import { Button } from "@/components/ui/enhanced-button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { 
  CheckCircle2, 
  Star, 
  AlertTriangle, 
  Users,
  Target,
  TrendingUp,
  Calendar,
  MessageSquare,
  ThumbsUp,
  ThumbsDown
} from "lucide-react";

type UserRole = "owner" | "admin" | "supervisor" | "employee";
type ReviewStatus = "pending" | "approved" | "rejected" | "needs_revision";
type QualityRating = 1 | 2 | 3 | 4 | 5;

interface QualityReview {
  id: string;
  task_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: QualityRating;
  feedback: string;
  status: ReviewStatus;
  created_at: string;
  updated_at: string;
  task?: {
    id: string;
    title: string;
    project?: {
      id: string;
      name: string;
    };
  };
  reviewer?: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
  };
  reviewee?: {
    id: string;
    full_name: string;
    email: string;
    avatar_url?: string;
  };
}

interface QualityMetrics {
  userId: string;
  userName: string;
  userEmail: string;
  avatar_url?: string;
  averageRating: number;
  totalReviews: number;
  approvedTasks: number;
  rejectedTasks: number;
  pendingReviews: number;
  qualityScore: number;
  improvementAreas: string[];
}

interface QualityReviewProps {
  organizationId: string;
  currentUserId: string;
  currentUserRole: UserRole;
}

export function QualityReview({ organizationId, currentUserId, currentUserRole }: QualityReviewProps) {
  const [reviews, setReviews] = useState<QualityReview[]>([]);
  const [qualityMetrics, setQualityMetrics] = useState<QualityMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [newReview, setNewReview] = useState({
    rating: 5,
    feedback: "",
    status: "approved" as ReviewStatus,
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchQualityData();
  }, [organizationId]);

  const fetchQualityData = async () => {
    try {
      // Get quality reviews for the organization
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('quality_reviews')
        .select(`
          *,
          task:tasks!inner(
            id,
            title,
            project:projects!inner(organization_id)
          ),
          reviewer:users!quality_reviews_reviewer_id_fkey(id, full_name, email, avatar_url),
          reviewee:users!quality_reviews_reviewee_id_fkey(id, full_name, email, avatar_url)
        `)
        .eq('task.project.organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (reviewsError) throw reviewsError;

      // Get employees for quality metrics
      const { data: allMembers } = await supabase
        .from('organization_members')
        .select(`
          user_id,
          role,
          users!inner(id, full_name, email, avatar_url)
        `)
        .eq('organization_id', organizationId);
      
      // Filter employees on client side
      const employees = allMembers?.filter(member => member.role === 'employee') || [];

      if (!employees) return;

      // Calculate quality metrics for each employee
      const metrics = await Promise.all(
        employees.map(async (employee: any) => {
          const userReviews = reviewsData?.filter(review => review.reviewee_id === employee.user_id) || [];
          
          const averageRating = userReviews.length > 0 
            ? userReviews.reduce((sum, review) => sum + review.rating, 0) / userReviews.length 
            : 0;

          const approvedTasks = userReviews.filter(r => r.status === 'approved').length;
          const rejectedTasks = userReviews.filter(r => r.status === 'rejected').length;
          const pendingReviews = userReviews.filter(r => r.status === 'pending').length;

          const qualityScore = userReviews.length > 0 
            ? Math.round((approvedTasks / userReviews.length) * 100)
            : 0;

          // Determine improvement areas based on ratings
          const improvementAreas: string[] = [];
          const lowRatedReviews = userReviews.filter(r => r.rating <= 2);
          if (lowRatedReviews.length > 0) {
            if (lowRatedReviews.some(r => r.feedback.toLowerCase().includes('code'))) {
              improvementAreas.push('Code Quality');
            }
            if (lowRatedReviews.some(r => r.feedback.toLowerCase().includes('test'))) {
              improvementAreas.push('Testing');
            }
            if (lowRatedReviews.some(r => r.feedback.toLowerCase().includes('document'))) {
              improvementAreas.push('Documentation');
            }
            if (lowRatedReviews.some(r => r.feedback.toLowerCase().includes('time'))) {
              improvementAreas.push('Time Management');
            }
          }

          return {
            userId: employee.user_id,
            userName: employee.users.full_name,
            userEmail: employee.users.email,
            avatar_url: employee.users.avatar_url,
            averageRating: Math.round(averageRating * 10) / 10,
            totalReviews: userReviews.length,
            approvedTasks,
            rejectedTasks,
            pendingReviews,
            qualityScore,
            improvementAreas,
          };
        })
      );

      setReviews(reviewsData || []);
      setQualityMetrics(metrics);
    } catch (error) {
      console.error('Error fetching quality data:', error);
      toast({
        title: "Error",
        description: "Failed to load quality review data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReview = async () => {
    if (!selectedTask || !newReview.feedback.trim()) {
      toast({
        title: "Required Fields",
        description: "Please select a task and provide feedback",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('quality_reviews')
        .insert({
          task_id: selectedTask,
          reviewer_id: currentUserId,
          reviewee_id: await getTaskAssignee(selectedTask),
          rating: newReview.rating,
          feedback: newReview.feedback,
          status: newReview.status,
        })
        .select(`
          *,
          task:tasks!inner(
            id,
            title,
            project:projects!inner(organization_id)
          ),
          reviewer:users!quality_reviews_reviewer_id_fkey(id, full_name, email, avatar_url),
          reviewee:users!quality_reviews_reviewee_id_fkey(id, full_name, email, avatar_url)
        `)
        .single();

      if (error) throw error;

      setReviews(prev => [data, ...prev]);
      setNewReview({
        rating: 5,
        feedback: "",
        status: "approved",
      });
      setReviewDialogOpen(false);
      setSelectedTask(null);

      toast({
        title: "Review Created",
        description: "Quality review has been submitted",
      });
    } catch (error) {
      console.error('Error creating review:', error);
      toast({
        title: "Error",
        description: "Failed to create review",
        variant: "destructive",
      });
    }
  };

  const getTaskAssignee = async (taskId: string) => {
    const { data } = await supabase
      .from('tasks')
      .select('assignee_id')
      .eq('id', taskId)
      .single();
    return data?.assignee_id;
  };

  const getRatingColor = (rating: QualityRating) => {
    if (rating >= 4) return 'text-green-600';
    if (rating >= 3) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getStatusColor = (status: ReviewStatus) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'needs_revision': return 'bg-yellow-100 text-yellow-800';
      case 'pending': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const renderStars = (rating: QualityRating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
        }`}
      />
    ));
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            Quality Review
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
              <CheckCircle2 className="w-5 h-5" />
              Quality Review
            </div>
            <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  New Review
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create Quality Review</DialogTitle>
                  <DialogDescription>
                    Review and rate a completed task
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="task">Select Task</Label>
                    <Select onValueChange={setSelectedTask}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a task to review" />
                      </SelectTrigger>
                      <SelectContent>
                        {/* This would be populated with completed tasks */}
                        <SelectItem value="task1">Sample Task 1</SelectItem>
                        <SelectItem value="task2">Sample Task 2</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="rating">Quality Rating</Label>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <Button
                          key={rating}
                          variant={newReview.rating === rating ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setNewReview(prev => ({ ...prev, rating: rating as QualityRating }))}
                        >
                          <Star className="w-4 h-4 mr-1" />
                          {rating}
                        </Button>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="status">Review Status</Label>
                    <Select 
                      value={newReview.status} 
                      onValueChange={(value: ReviewStatus) => setNewReview(prev => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="needs_revision">Needs Revision</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="feedback">Feedback</Label>
                    <Textarea
                      id="feedback"
                      placeholder="Provide detailed feedback on the work quality..."
                      value={newReview.feedback}
                      onChange={(e) => setNewReview(prev => ({ ...prev, feedback: e.target.value }))}
                      rows={4}
                    />
                  </div>
                  
                  <div className="flex gap-2">
                    <Button onClick={handleCreateReview} className="flex-1">
                      Submit Review
                    </Button>
                    <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          <div className="space-y-6">
            {/* Quality Metrics */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Team Quality Metrics
              </h3>
              <div className="space-y-4">
                {qualityMetrics.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No team members found</p>
                  </div>
                ) : (
                  qualityMetrics.map((metric) => (
                    <div key={metric.userId} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={metric.avatar_url || undefined} />
                            <AvatarFallback>
                              {metric.userName.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{metric.userName}</div>
                            <div className="text-sm text-muted-foreground">{metric.userEmail}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-primary">
                            {metric.averageRating}/5
                          </div>
                          <div className="text-sm text-muted-foreground">Avg Rating</div>
                        </div>
                      </div>
                      
                      <div className="mb-3">
                        <div className="flex justify-between text-sm mb-1">
                          <span>Quality Score</span>
                          <span>{metric.qualityScore}%</span>
                        </div>
                        <Progress value={metric.qualityScore} className="h-2" />
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          <div>
                            <div className="font-medium">{metric.approvedTasks}</div>
                            <div className="text-muted-foreground">Approved</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                          <div>
                            <div className="font-medium">{metric.rejectedTasks}</div>
                            <div className="text-muted-foreground">Rejected</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-4 h-4 text-blue-500" />
                          <div>
                            <div className="font-medium">{metric.pendingReviews}</div>
                            <div className="text-muted-foreground">Pending</div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Star className="w-4 h-4 text-yellow-500" />
                          <div>
                            <div className="font-medium">{metric.totalReviews}</div>
                            <div className="text-muted-foreground">Total Reviews</div>
                          </div>
                        </div>
                      </div>
                      
                      {metric.improvementAreas.length > 0 && (
                        <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <div className="flex items-center gap-2 text-yellow-700 mb-1">
                            <AlertTriangle className="w-4 h-4" />
                            <span className="text-sm font-medium">Improvement Areas</span>
                          </div>
                          <div className="text-sm text-yellow-600">
                            {metric.improvementAreas.join(', ')}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Reviews */}
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Recent Quality Reviews
              </h3>
              <div className="space-y-3">
                {reviews.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No quality reviews found</p>
                  </div>
                ) : (
                  reviews.slice(0, 10).map((review) => (
                    <div key={review.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={review.reviewee?.avatar_url || undefined} />
                            <AvatarFallback className="text-xs">
                              {review.reviewee?.full_name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{review.task?.title}</div>
                            <div className="text-sm text-muted-foreground">
                              {review.reviewee?.full_name} • {review.task?.project?.name}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            {renderStars(review.rating)}
                          </div>
                          <Badge className={getStatusColor(review.status)}>
                            {review.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                      
                      {review.feedback && (
                        <div className="mt-2 p-2 bg-muted/50 rounded-lg">
                          <div className="text-sm">{review.feedback}</div>
                        </div>
                      )}
                      
                      <div className="mt-2 text-xs text-muted-foreground">
                        Reviewed by {review.reviewer?.full_name} • {new Date(review.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
