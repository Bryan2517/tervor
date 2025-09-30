import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/enhanced-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/enhanced-card";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Clock, 
  CheckCircle2, 
  XCircle,
  Calendar,
  User,
  Building2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createDailyCheckIn } from "@/lib/attendance";
import { getTimeInMY, todayInMY } from "@/lib/tz";

interface DailyCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  orgId: string;
  userId: string;
  orgName?: string;
}

export function DailyCheckInModal({
  isOpen,
  onClose,
  onSuccess,
  orgId,
  userId,
  orgName = "your organization"
}: DailyCheckInModalProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleCheckIn = async () => {
    setLoading(true);
    try {
      const { data, error } = await createDailyCheckIn(orgId, userId, 'web');
      
      if (error) {
        // Handle unique violation (already checked in)
        if (error.code === '23505') {
          toast({
            title: "Already Checked In",
            description: "You've already checked in for today.",
            variant: "default",
          });
          onClose();
          return;
        }
        
        throw error;
      }

      const currentTime = getTimeInMY(new Date());
      
      toast({
        title: "Checked In Successfully!",
        description: `You've checked in at ${currentTime} for ${orgName}`,
      });

      if (onSuccess) {
        onSuccess();
      }
      
      onClose();
    } catch (error: any) {
      console.error("Error checking in:", error);
      toast({
        title: "Check-in Failed",
        description: error.message || "Could not check in. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNotNow = () => {
    onClose();
  };

  const currentTime = getTimeInMY(new Date());
  const today = todayInMY();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl">Check in for today?</DialogTitle>
              <DialogDescription className="text-base">
                This records your clock-in time for your supervisor to view.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Card variant="outline" className="mb-4">
          <CardContent className="pt-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Date:</span>
                <Badge variant="secondary">{today}</Badge>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Time:</span>
                <span className="font-mono">{currentTime}</span>
              </div>
              
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Organization:</span>
                <span>{orgName}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3 mb-4">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <p className="font-medium">What happens when you check in:</p>
              <ul className="mt-1 space-y-1 text-xs">
                <li>• Your check-in time is recorded with server timestamp</li>
                <li>• Your supervisor can see your attendance in real-time</li>
                <li>• This helps track team productivity and availability</li>
              </ul>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleNotNow}
            disabled={loading}
            className="flex-1"
          >
            <XCircle className="w-4 h-4 mr-2" />
            Not now
          </Button>
          <Button
            onClick={handleCheckIn}
            disabled={loading}
            className="flex-1"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Checking in...</span>
              </div>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Check in
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
