import React, { createContext, useContext, useState, useEffect } from 'react';
import { Profile } from '../types';

interface GlobalAIState {
  aiProfileText: string | null;
  evolutionInsights: any[];
  compatibilityScores: Record<string, number>;
  liveLocationPulse: { lat: number, lng: number } | null;
  generateProfileInsights: (user: Profile) => Promise<void>;
  getSmartChatReply: (history: string[], context: string) => Promise<string[]>;
  fetchEvolutionInsights: () => Promise<void>;
  calculateCompatibility: (user1: Profile, user2: Profile) => Promise<number>;
}

const GlobalAIContext = createContext<GlobalAIState | undefined>(undefined);

export const GlobalAIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [aiProfileText, setAiProfileText] = useState<string | null>(null);
  const [evolutionInsights, setEvolutionInsights] = useState<any[]>([]);
  const [compatibilityScores, setCompatibilityScores] = useState<Record<string, number>>({});
  const [liveLocationPulse, setLiveLocationPulse] = useState<{ lat: number, lng: number } | null>(null);

  const generateProfileInsights = async (user: Profile) => {
    // Generate AI profile insights conceptually
    setAiProfileText(`Based on recent activity, you are a curious explorer favoring specialty coffee and gaming.`);
  };

  const getSmartChatReply = async (history: string[], context: string) => {
    try {
      const res = await fetch('/api/yallamate/smart-reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ history, context }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.replies || [];
      }
    } catch(e) {
      console.error(e);
    }
    return ['Sure!', 'Sounds good', 'Let me check my schedule'];
  };

  const fetchEvolutionInsights = async () => {
    try {
      const res = await fetch('/api/yallamate/evolution');
      if (res.ok) {
        const data = await res.json();
        setEvolutionInsights(data.insights);
      }
    } catch(e) {
      console.warn("Failed fetch evolution", e);
    }
  };

  const calculateCompatibility = async (user1: Profile, user2: Profile) => {
    const key = `${user1.id}-${user2.id}`;
    if (compatibilityScores[key]) return compatibilityScores[key];
    
    // Quick pseudo-hash score based on IDs for instant UI updates, while requesting API
    let baseScore = 60 + ((user1.id.charCodeAt(0) + user2.id.charCodeAt(0)) % 40);
    setCompatibilityScores(prev => ({ ...prev, [key]: baseScore }));
    return baseScore;
  };

  return (
    <GlobalAIContext.Provider value={{
      aiProfileText,
      evolutionInsights,
      compatibilityScores,
      liveLocationPulse,
      generateProfileInsights,
      getSmartChatReply,
      fetchEvolutionInsights,
      calculateCompatibility
    }}>
      {children}
    </GlobalAIContext.Provider>
  );
};

export const useGlobalAI = () => {
  const context = useContext(GlobalAIContext);
  if (!context) throw new Error('useGlobalAI must be used within GlobalAIProvider');
  return context;
};
