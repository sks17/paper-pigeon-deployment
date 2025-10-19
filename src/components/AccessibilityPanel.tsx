import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Settings, Eye, Palette, Zap, Type } from 'lucide-react';
import { useAccessibility } from '@/contexts/AccessibilityContext';

const AccessibilityPanel: React.FC = () => {
  const {
    settings,
    toggleHighContrast,
    toggleColorblindMode,
    toggleReducedMotion,
    setFontSize,
  } = useAccessibility();

  const colorblindLabels = {
    none: 'Normal',
    protanopia: 'Protanopia',
    deuteranopia: 'Deuteranopia',
    tritanopia: 'Tritanopia',
  };

  return (
    <Card className="w-80 shadow-lg border bg-card/95 backdrop-blur-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center space-x-2">
          <Settings className="w-5 h-5" />
          <h3 className="font-semibold text-lg">Accessibility</h3>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* High Contrast */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Eye className="w-4 h-4" />
            <span className="text-sm">High Contrast</span>
          </div>
          <Button
            variant={settings.highContrast ? 'default' : 'outline'}
            size="sm"
            onClick={toggleHighContrast}
            className="transition-all duration-200"
          >
            {settings.highContrast ? 'On' : 'Off'}
          </Button>
        </div>

        <Separator />

        {/* Colorblind Mode */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Palette className="w-4 h-4" />
            <span className="text-sm">Color Vision</span>
          </div>
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs">
              {colorblindLabels[settings.colorblindMode]}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleColorblindMode}
              className="transition-all duration-200"
            >
              Cycle
            </Button>
          </div>
        </div>

        <Separator />

        {/* Reduced Motion */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4" />
            <span className="text-sm">Reduced Motion</span>
          </div>
          <Button
            variant={settings.reducedMotion ? 'default' : 'outline'}
            size="sm"
            onClick={toggleReducedMotion}
            className="transition-all duration-200"
          >
            {settings.reducedMotion ? 'On' : 'Off'}
          </Button>
        </div>

        <Separator />

        {/* Font Size */}
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Type className="w-4 h-4" />
            <span className="text-sm">Font Size</span>
          </div>
          <div className="flex space-x-1">
            {(['small', 'medium', 'large'] as const).map((size) => (
              <Button
                key={size}
                variant={settings.fontSize === size ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFontSize(size)}
                className="capitalize transition-all duration-200"
              >
                {size}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AccessibilityPanel;
