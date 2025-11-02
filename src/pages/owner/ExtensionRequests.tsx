import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CalendarClock, 
  CheckCircle2, 
  XCircle, 
  Clock,
  User,
  Calendar,
  FileText,
  AlertCircle,
  ArrowLeft
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOrganization } from "@/contexts/OrganizationContext";
import { format } from "date-fns";

interface ExtensionRequest {
  id: string;
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
  decision_note: string | null;
  reason: string | null;
  requested_due_at: string;
  status: 'pending' | 'approved' | 'rejected';
  task_id: string | null;
  requester?: {
    full_name: string;
    email: string;
  };
  task?: {
    title: string;
    description: string;
    due_date: string;
    task_type: string;
    priority: string;
  };
}

export default function ExtensionRequests() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { organization } = useOrganization();
  const [requests, setRequests] = useState<ExtensionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedRequest, setSelectedRequest] = useState<ExtensionRequest | null>(null);
  const [decisionDialogOpen, setDecisionDialogOpen] = useState(false);
  const [decisionAction, setDecisionAction] = useState<'approve' | 'reject'>('approve');
  const [decisionNote, setDecisionNote] = useState("");
  const [searchParams] = useSearchParams();

  // Initialize tab from query param only once on mount or when URL changes
  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && ["pending", "approved", "rejected"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Fetch data when organization or activeTab changes
  useEffect(() => {
    if (organization) {
      fetchExtensionRequests();
    }
  }, [organization, activeTab]);

  const fetchExtensionRequests = async () => {
    try {
      setLoading(true);

      if (!organization) return;

      // Get all projects in the organization
      const { data: orgProjects } = await supabase
        .from("projects")
        .select("id")
        .eq("organization_id", organization.id);

      if (!orgProjects || orgProjects.length === 0) {
        setRequests([]);
        setLoading(false);
        return;
      }

      const projectIds = orgProjects.map(p => p.id);

      // Get all tasks in these projects
      const { data: orgTasks } = await supabase
        .from("tasks")
        .select("id")
        .in("project_id", projectIds);

      if (!orgTasks || orgTasks.length === 0) {
        setRequests([]);
        setLoading(false);
        return;
      }

      const taskIds = orgTasks.map(t => t.id);

      // Fetch extension requests for those tasks
      const { data: extensionData, error } = await supabase
        .from("extension_requests")
        .select(`
          *,
          requester:users!extension_requests_requester_id_fkey(full_name, email),
          task:tasks!extension_requests_task_id_fkey(title, description, due_date, task_type, priority)
        `)
        .in("task_id", taskIds)
        .eq("status", activeTab)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setRequests(extensionData as any || []);
    } catch (error) {
      console.error("Error fetching extension requests:", error);
      toast({
        title: "Error",
        description: "Failed to load extension requests",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openDecisionDialog = (request: ExtensionRequest, action: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setDecisionAction(action);
    setDecisionNote("");
    setDecisionDialogOpen(true);
  };

  const handleDecision = async () => {
    if (!selectedRequest) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Update the extension request
      const { error: requestError } = await supabase
        .from("extension_requests")
        .update({
          status: decisionAction === 'approve' ? 'approved' : 'rejected',
          decided_by: user.id,
          decided_at: new Date().toISOString(),
          decision_note: decisionNote || null,
        })
        .eq("id", selectedRequest.id);

      if (requestError) throw requestError;

      // If approved, update the task's due date
      if (decisionAction === 'approve' && selectedRequest.task_id) {
        const { error: taskError } = await supabase
          .from("tasks")
          .update({
            due_date: selectedRequest.requested_due_at,
          })
          .eq("id", selectedRequest.task_id);

        if (taskError) throw taskError;
      }

      toast({
        title: `Extension ${decisionAction === 'approve' ? 'Approved' : 'Rejected'}`,
        description: `The extension request has been ${decisionAction === 'approve' ? 'approved' : 'rejected'} successfully`,
      });

      setDecisionDialogOpen(false);
      setSelectedRequest(null);
      setDecisionNote("");
      fetchExtensionRequests();
    } catch (error) {
      console.error("Error processing decision:", error);
      toast({
        title: "Error",
        description: "Failed to process the decision",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">Pending</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">Approved</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <Badge variant="destructive">Urgent</Badge>;
      case 'high':
        return <Badge variant="destructive">High</Badge>;
      case 'medium':
        return <Badge variant="default">Medium</Badge>;
      case 'low':
        return <Badge variant="secondary">Low</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const getTaskTypeBadge = (taskType: string) => {
    return taskType === 'assignment' ? (
      <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300">Assignment</Badge>
    ) : (
      <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">Task</Badge>
    );
  };

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
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <CalendarClock className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Extension Requests</h1>
              <p className="text-sm text-muted-foreground">Review and manage deadline extension requests</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="pending" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Pending
            </TabsTrigger>
            <TabsTrigger value="approved" className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Approved
            </TabsTrigger>
            <TabsTrigger value="rejected" className="flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              Rejected
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="space-y-4">
            {requests.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-12">
                    <CalendarClock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground font-medium mb-2">
                      No {activeTab} extension requests
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {activeTab === 'pending' 
                        ? "All extension requests have been reviewed"
                        : `No extension requests have been ${activeTab}`
                      }
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              requests.map((request) => (
                <Card key={request.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-lg">{request.task?.title}</h3>
                            {getTaskTypeBadge(request.task?.task_type || '')}
                            {getPriorityBadge(request.task?.priority || '')}
                          </div>
                          {request.task?.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                              {request.task.description}
                            </p>
                          )}
                        </div>
                        <div>
                          {getStatusBadge(request.status)}
                        </div>
                      </div>

                      {/* Details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-sm">
                            <User className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">Requested by:</span>
                            <span>{request.requester?.full_name || 'Unknown'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">Requested on:</span>
                            <span>{request.created_at ? format(new Date(request.created_at), "MMM dd, yyyy") : 'N/A'}</span>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-sm">
                            <AlertCircle className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">Current due:</span>
                            <span>{request.task?.due_date ? format(new Date(request.task.due_date), "MMM dd, yyyy") : 'N/A'}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <CalendarClock className="w-4 h-4 text-primary" />
                            <span className="font-medium">Requested due:</span>
                            <span className="text-primary font-medium">
                              {request.requested_due_at ? format(new Date(request.requested_due_at), "MMM dd, yyyy") : 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Reason */}
                      {request.reason && (
                        <div className="p-4 bg-muted/30 rounded-lg">
                          <div className="flex items-start gap-2 text-sm">
                            <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
                            <div>
                              <span className="font-medium block mb-1">Reason:</span>
                              <p className="text-muted-foreground">{request.reason}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Decision Note (for approved/rejected) */}
                      {request.decision_note && request.status !== 'pending' && (
                        <div className="p-4 bg-muted/30 rounded-lg border-l-4 border-primary">
                          <div className="flex items-start gap-2 text-sm">
                            <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
                            <div>
                              <span className="font-medium block mb-1">Decision Note:</span>
                              <p className="text-muted-foreground">{request.decision_note}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Action Buttons (only for pending) */}
                      {request.status === 'pending' && (
                        <div className="flex items-center gap-3 pt-2">
                          <Button
                            onClick={() => openDecisionDialog(request, 'approve')}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Approve Extension
                          </Button>
                          <Button
                            onClick={() => openDecisionDialog(request, 'reject')}
                            variant="destructive"
                          >
                            <XCircle className="w-4 h-4 mr-2" />
                            Reject Request
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Decision Dialog */}
      <Dialog open={decisionDialogOpen} onOpenChange={setDecisionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decisionAction === 'approve' ? 'Approve' : 'Reject'} Extension Request
            </DialogTitle>
            <DialogDescription>
              {decisionAction === 'approve' 
                ? `Approve the extension for "${selectedRequest?.task?.title || 'this task'}" to ${selectedRequest?.requested_due_at ? format(new Date(selectedRequest.requested_due_at), "MMM dd, yyyy") : 'the requested date'}`
                : `Reject the extension request for "${selectedRequest?.task?.title || 'this task'}"`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="decision-note">
                Note (Optional)
              </Label>
              <Textarea
                id="decision-note"
                value={decisionNote}
                onChange={(e) => setDecisionNote(e.target.value)}
                placeholder={`Add a note about your decision...`}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setDecisionDialogOpen(false);
                setSelectedRequest(null);
                setDecisionNote("");
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleDecision}
              className={decisionAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
              variant={decisionAction === 'reject' ? 'destructive' : 'default'}
            >
              {decisionAction === 'approve' ? (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Approve
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

