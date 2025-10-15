import { useState } from "react";
import { Button } from "@/components/ui/enhanced-button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ClockOutButtonProps {
  organizationId: string;
  organizationName: string;
  onClockOut: () => void;
}

export function ClockOutButton({ organizationId, organizationName, onClockOut }: ClockOutButtonProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [clockingOut, setClockingOut] = useState(false);
  const { toast } = useToast();

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
            <AlertDialogDescription>
              Do you want to clock out from <strong>{organizationName}</strong>? This will stop tracking your time and return you to your organizations dashboard.
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
