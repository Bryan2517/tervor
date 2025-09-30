import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { hasCheckedInToday } from "@/lib/attendance";
import { todayInMY } from "@/lib/tz";

interface UseDailyCheckInProps {
  userId: string | null;
  orgId: string | null;
  orgName?: string;
}

export function useDailyCheckIn({ userId, orgId, orgName }: UseDailyCheckInProps) {
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (!userId || !orgId) {
      setShowCheckInModal(false);
      return;
    }

    const checkDailyCheckIn = async () => {
      setIsChecking(true);
      try {
        const dateISO = todayInMY();
        const { error, count } = await hasCheckedInToday(orgId, userId, dateISO);
        
        if (!error && (count ?? 0) === 0) {
          // User hasn't checked in today, show modal
          setShowCheckInModal(true);
        }
      } catch (error) {
        console.error("Error checking daily check-in status:", error);
      } finally {
        setIsChecking(false);
      }
    };

    // Small delay to ensure auth and org are fully loaded
    const timer = setTimeout(checkDailyCheckIn, 1000);
    return () => clearTimeout(timer);
  }, [userId, orgId]);

  const closeModal = () => {
    setShowCheckInModal(false);
  };

  const handleCheckInSuccess = () => {
    setShowCheckInModal(false);
    // Optionally refresh any relevant data
  };

  return {
    showCheckInModal,
    isChecking,
    closeModal,
    handleCheckInSuccess,
    // Props for the modal
    modalProps: {
      isOpen: showCheckInModal,
      onClose: closeModal,
      onSuccess: handleCheckInSuccess,
      orgId: orgId || '',
      userId: userId || '',
      orgName
    }
  };
}
