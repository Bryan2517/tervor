import React, { createContext, useContext, ReactNode } from 'react';

interface PresenceContextType {
  setUserOnline: () => Promise<void>;
  setUserOffline: () => Promise<void>;
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined);

export const usePresence = () => {
  const context = useContext(PresenceContext);
  if (context === undefined) {
    throw new Error('usePresence must be used within a PresenceProvider');
  }
  return context;
};

interface PresenceProviderProps {
  children: ReactNode;
  setUserOnline: () => Promise<void>;
  setUserOffline: () => Promise<void>;
}

export const PresenceProvider: React.FC<PresenceProviderProps> = ({ 
  children, 
  setUserOnline, 
  setUserOffline 
}) => {
  return (
    <PresenceContext.Provider value={{ setUserOnline, setUserOffline }}>
      {children}
    </PresenceContext.Provider>
  );
};
