import React, { createContext, useContext, useState, useCallback } from 'react';

interface AiFeatureContextType {
  aiEnabled: boolean;
  setAiEnabled: (enabled: boolean) => void;
}

const AiFeatureContext = createContext<AiFeatureContextType>({
  aiEnabled: true,
  setAiEnabled: () => {},
});

export const useAiEnabled = () => useContext(AiFeatureContext).aiEnabled;
export const useAiFeature = () => useContext(AiFeatureContext);

export const AiFeatureProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [aiEnabled, setAiEnabledState] = useState(true);
  const setAiEnabled = useCallback((enabled: boolean) => {
    setAiEnabledState(enabled);
  }, []);
  return (
    <AiFeatureContext.Provider value={{ aiEnabled, setAiEnabled }}>
      {children}
    </AiFeatureContext.Provider>
  );
};

export default AiFeatureContext;
