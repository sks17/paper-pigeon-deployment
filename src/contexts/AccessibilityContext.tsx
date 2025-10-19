import React, { createContext, useContext, useState, useEffect } from 'react';

interface AccessibilitySettings {
  highContrast: boolean;
  colorblindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  reducedMotion: boolean;
  fontSize: 'small' | 'medium' | 'large';
}

interface AccessibilityContextType {
  settings: AccessibilitySettings;
  updateSettings: (newSettings: Partial<AccessibilitySettings>) => void;
  toggleHighContrast: () => void;
  toggleColorblindMode: () => void;
  toggleReducedMotion: () => void;
  setFontSize: (size: AccessibilitySettings['fontSize']) => void;
}

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
};

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AccessibilitySettings>({
    highContrast: false,
    colorblindMode: 'none',
    reducedMotion: false,
    fontSize: 'medium',
  });

  // Load settings from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('accessibility-settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.warn('Failed to parse accessibility settings:', e);
      }
    }
  }, []);

  // Save settings to localStorage when they change
  useEffect(() => {
    localStorage.setItem('accessibility-settings', JSON.stringify(settings));
  }, [settings]);

  // Apply CSS custom properties based on settings
  useEffect(() => {
    const root = document.documentElement;
    
    // High contrast
    root.style.setProperty('--accessibility-high-contrast', settings.highContrast ? '1' : '0');
    
    // Colorblind mode
    root.style.setProperty('--accessibility-colorblind', settings.colorblindMode);
    
    // Reduced motion
    root.style.setProperty('--accessibility-reduced-motion', settings.reducedMotion ? '1' : '0');
    
    // Font size
    const fontSizeMap = { small: '14px', medium: '16px', large: '18px' };
    root.style.setProperty('--accessibility-font-size', fontSizeMap[settings.fontSize]);
  }, [settings]);

  const updateSettings = (newSettings: Partial<AccessibilitySettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const toggleHighContrast = () => {
    setSettings(prev => ({ ...prev, highContrast: !prev.highContrast }));
  };

  const toggleColorblindMode = () => {
    const modes: AccessibilitySettings['colorblindMode'][] = ['none', 'protanopia', 'deuteranopia', 'tritanopia'];
    const currentIndex = modes.indexOf(settings.colorblindMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setSettings(prev => ({ ...prev, colorblindMode: modes[nextIndex] }));
  };

  const toggleReducedMotion = () => {
    setSettings(prev => ({ ...prev, reducedMotion: !prev.reducedMotion }));
  };

  const setFontSize = (fontSize: AccessibilitySettings['fontSize']) => {
    setSettings(prev => ({ ...prev, fontSize }));
  };

  return (
    <AccessibilityContext.Provider
      value={{
        settings,
        updateSettings,
        toggleHighContrast,
        toggleColorblindMode,
        toggleReducedMotion,
        setFontSize,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
};
