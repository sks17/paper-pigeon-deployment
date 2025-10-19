import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, Building2, User } from 'lucide-react';
import { type LabInfo, type Researcher } from '@/services/dynamodb';

interface LabModalProps {
  labId: string | null;
  labName: string | null;
  isOpen: boolean;
  onClose: () => void;
  labInfo: LabInfo | null;
  faculty: Researcher[];
  onClickResearcher: (researcherId: string) => void;
}

const LabModal: React.FC<LabModalProps> = ({
  labId,
  labName,
  isOpen,
  onClose,
  labInfo,
  faculty,
  onClickResearcher,
}) => {
  const [isClosing, setIsClosing] = useState(false);
  const [showFullDesc, setShowFullDesc] = useState(false);

  // Hooks must be called unconditionally and in the same order
  const description = labInfo?.description || '';
  const hasFaculty = faculty && faculty.length > 0;
  const preview = useMemo(() => {
    const MAX = 240;
    if (!description) return '';
    return description.length > MAX ? description.slice(0, MAX) + '…' : description;
  }, [description]);

  if (!isOpen || !labId) return null;

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
      <div className={`relative z-10 w-full max-w-2xl mx-4 transition-all duration-200 ${isClosing ? 'opacity-0 translate-y-4 scale-95' : 'opacity-100 translate-y-0 scale-100'}`}>
        <Card className="shadow-2xl border bg-card">
          <CardHeader className="pb-4 relative">
            <button
              onClick={handleRequestClose}
              className="absolute top-4 right-4 p-2 hover:bg-muted rounded-full"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex items-center space-x-3 pr-10">
              <div className="w-10 h-10 rounded bg-primary flex items-center justify-center text-primary-foreground">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-xl text-foreground truncate">{labName || labId}</h2>
                <Badge variant="outline" className="text-xs mt-1">{labId}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 max-h-[60vh] overflow-y-auto">
            {description && (
              <div>
                <div className="text-sm text-muted-foreground mb-1">Description</div>
                <p className="text-base text-foreground leading-relaxed">
                  {showFullDesc ? description : preview}
                  {description.length > preview.length && (
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs ml-1 align-baseline text-muted-foreground hover:text-foreground" onClick={() => setShowFullDesc(v => !v)}>
                      {showFullDesc ? 'Show less' : 'Read more'}
                    </Button>
                  )}
                </p>
              </div>
            )}

            {hasFaculty && (
              <div>
                <div className="text-sm text-muted-foreground mb-2">Faculty</div>
                <div className="flex flex-wrap gap-2">
                  {faculty.map(f => (
                    <button
                      key={f.researcher_id}
                      onClick={() => onClickResearcher(f.researcher_id)}
                      className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-full border hover:bg-muted transition-colors text-sm"
                    >
                      <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                        <User className="w-3.5 h-3.5" />
                      </span>
                      <span className="font-medium">{f.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LabModal;


