import { useState, useEffect } from "react";
import { Button } from "@/components/ui/enhanced-button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { LogOut, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePresence } from "@/contexts/PresenceContext";

interface ClockOutButtonProps {
  organizationId: string;
  organizationName: string;
  onClockOut: () => void;
}

export function ClockOutButton({ organizationId, organizationName, onClockOut }: ClockOutButtonProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [clockingOut, setClockingOut] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const { toast } = useToast();
  
  // Try to get presence context, but don't fail if not available
  let presenceContext;
  try {
    presenceContext = usePresence();
  } catch (error) {
    // Presence context not available, that's okay
    presenceContext = null;
  }

  // Update current time every second when dialog is open
  useEffect(() => {
    if (!showDialog) return;
    
    // Update immediately when dialog opens
    setCurrentTime(new Date());
    
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, [showDialog]);

  const formatTime = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const handleConfirmClockOut = async () => {
    setClockingOut(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("User not found");

      const { error } = await supabase.rpc('clock_out_from_org', {
        p_org_id: organizationId,
        p_user_id: user.id
      });

      if (error) throw error;

      // Set user presence to offline
      if (presenceContext?.setUserOffline) {
        await presenceContext.setUserOffline();
      }

      toast({
        title: "Clocked Out",
        description: `Successfully clocked out from ${organizationName}`,
      });

      onClockOut();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to clock out",
        variant: "destructive",
      });
    } finally {
      setClockingOut(false);
      setShowDialog(false);
    }
  };

  return (
    <>
      <Button 
        variant="outline" 
        onClick={() => setShowDialog(true)}
      >
        <LogOut className="w-4 h-4 mr-2" />
        Clock Out
      </Button>

      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clock Out</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Do you want to clock out from <strong>{organizationName}</strong>? This will stop tracking your time and return you to your organizations dashboard.
              </p>
              <div className="flex items-center justify-center gap-2 p-4 bg-muted rounded-lg">
                <Clock className="w-5 h-5 text-primary" />
                <span className="text-2xl font-mono font-bold text-foreground">
                  {formatTime(currentTime)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                This is the time that will be recorded for your clock out
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClockOut} disabled={clockingOut}>
              {clockingOut ? "Clocking Out..." : "Clock Out"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
