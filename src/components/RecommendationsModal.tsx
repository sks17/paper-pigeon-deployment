import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { X, UserCheck } from 'lucide-react';

export interface RecommendationItem {
  name: string;
  score: number;
  rationale?: string;
}

interface RecommendationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  recommendations: RecommendationItem[];
  onClickResearcher: (researcherId: string) => void;
  // Map from name -> researcher_id (to enable profile click)
  nameToResearcherId: Map<string, string>;
}

const RecommendationsModal: React.FC<RecommendationsModalProps> = ({
  isOpen,
  onClose,
  recommendations,
  onClickResearcher,
  nameToResearcherId,
}) => {
  if (!isOpen) return null;

  const [isClosing, setIsClosing] = useState(false);
  const [isEntering, setIsEntering] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setIsEntering(false), 10);
    return () => clearTimeout(t);
  }, []);

  const handleRequestClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 220);
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-200 ${isClosing ? 'opacity-0' : 'opacity-100'}`}>
      <div className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${isClosing ? 'opacity-0' : 'opacity-100'}`} onClick={handleRequestClose} />
      <div className={`relative z-10 w-full max-w-2xl mx-4 transition-all duration-200 ${isClosing || isEntering ? 'opacity-0 translate-y-4 scale-95' : 'opacity-100 translate-y-0 scale-100'}`}>
        <Card className="shadow-2xl border bg-card transition-all duration-200">
          <CardHeader className="pb-4 relative">
            <button
              onClick={handleRequestClose}
              className="absolute top-4 right-4 p-2 hover:bg-muted rounded-full"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-3 pr-10">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-xl text-foreground">Recommended Researchers</h2>
                <p className="text-sm text-muted-foreground">Based on your resume</p>
              </div>
            </div>
          </CardHeader>

          <Separator />

          <CardContent className="p-4">
            {recommendations.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                No recommendations yet.
              </div>
            ) : (
              <div className="space-y-2">
                {recommendations.map((rec, idx) => {
                  const researcherId = nameToResearcherId.get(rec.name);
                  const clickable = Boolean(researcherId);
                  // Stronger calibration to increase displayed match
                  const boosted = Math.min(1, rec.score * 2.0 + 0.25);
                  const scorePct = Math.round(boosted * 100);
                  return (
                    <div
                      key={`${rec.name}-${idx}`}
                      className={`flex items-start justify-between p-3 rounded-lg border ${clickable ? 'cursor-pointer hover:bg-muted/60' : ''}`}
                      onClick={() => {
                        if (researcherId) onClickResearcher(researcherId);
                      }}
                    >
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground truncate">{rec.name}</span>
                          <Badge variant="secondary" className="text-xs">{scorePct}% match</Badge>
                        </div>
                        {rec.rationale && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{rec.rationale}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, scorePct))}%`, transition: 'width 200ms ease' }} />
                        </div>
                        <Button variant="ghost" size="sm" disabled={!clickable}>View</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RecommendationsModal;


