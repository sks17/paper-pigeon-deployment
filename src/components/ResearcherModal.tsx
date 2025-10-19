import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Mail, Phone, Globe, GraduationCap, Building2, User, FileText, Calendar, X, Tag, ExternalLink, Loader2 } from 'lucide-react';
import { type Researcher, type Paper } from '../services/dynamodb';
import { s3Service } from '../services/s3';
import { DynamoDBService } from '../services/dynamodb';

interface ResearcherModalProps {
  researcher: Researcher | null;
  isOpen: boolean;
  onClose: () => void;
  onPaperChat?: (paper: Paper) => void;
}

const ResearcherModal: React.FC<ResearcherModalProps> = ({
  researcher,
  isOpen,
  onClose,
  onPaperChat,
}) => {
  const [loadingPdfs, setLoadingPdfs] = useState<Set<string>>(new Set());
  const [isClosing, setIsClosing] = useState(false);

  const handleRequestClose = () => {
    if (isClosing) return; // prevent re-entrancy
    setIsClosing(true);
    // Match the animate-out duration below
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 220);
  };
  const [showFullAbout, setShowFullAbout] = useState(false);

  if (!researcher || !isOpen) return null;

  const handlePdfClick = async (paper: Paper) => {
    if (!paper.document_id) return;
    
    const documentId = paper.document_id;
    setLoadingPdfs(prev => new Set(prev).add(documentId));
    
    try {
      // Get lab_id for the paper
      const labId = await DynamoDBService.fetchPaperLabId(documentId);
      
      if (!labId) {
        console.error('No lab_id found for paper:', documentId);
        alert('PDF not available - lab information not found');
        return;
      }
      
      // Generate presigned URL
      const pdfUrl = await s3Service.getPresignedPdfUrl(labId, documentId);
      
      // Open PDF in new tab
      window.open(pdfUrl, '_blank');
    } catch (error) {
      console.error('Error opening PDF:', error);
      alert('Failed to open PDF. Please try again.');
    } finally {
      setLoadingPdfs(prev => {
        const newSet = new Set(prev);
        newSet.delete(documentId);
        return newSet;
      });
    }
  };



  const formatContactInfo = (contact: string) => {
    // Check if it's an email
    if (contact.includes('@')) {
      return { type: 'email', value: contact, icon: Mail };
    }
    // Check if it's a phone number
    if (/^[\+]?[1-9][\d]{0,15}$/.test(contact.replace(/[\s\-\(\)]/g, ''))) {
      return { type: 'phone', value: contact, icon: Phone };
    }
    // Check if it's a URL
    if (contact.startsWith('http') || contact.includes('.')) {
      return { type: 'url', value: contact, icon: Globe };
    }
    // Default to other
    return { type: 'other', value: contact, icon: User };
  };

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center transition-opacity duration-200 ease-out ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200 ease-out ${
          isClosing ? 'opacity-0' : 'opacity-100'
        }`}
        onClick={handleRequestClose}
      />
      
      {/* Modal */}
      <div
        className={`relative z-10 w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden transition-all duration-200 ease-out ${
          isClosing
            ? 'opacity-0 translate-y-4 scale-95'
            : 'opacity-100 translate-y-0 scale-100'
        }`}
      >
        <Card className="shadow-2xl border bg-card transition-all duration-300 hover:shadow-3xl">
          {/* Header with close button */}
          <CardHeader className="pb-4 relative">
            <button
              onClick={handleRequestClose}
              className="absolute top-4 right-4 p-2 hover:bg-muted rounded-full transition-all duration-200 hover:scale-110"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex items-center space-x-4 pr-12">
              <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-xl">
                {researcher.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-2xl text-foreground">
                  {researcher.name}
                </h2>
                <div className="flex items-center space-x-3 mt-2">
                  {researcher.standing && (
                    <Badge variant="secondary" className="text-sm">
                      {researcher.standing}
                    </Badge>
                  )}
                  {researcher.influence !== undefined && (
                    <Badge 
                      variant="secondary" 
                      className={`text-sm font-medium hover:!bg-inherit hover:!text-inherit ${
                        researcher.influence >= 80 
                          ? 'bg-green-600 text-white border-green-700' 
                          : researcher.influence >= 60 
                          ? 'bg-green-500 text-white border-green-600'
                          : researcher.influence >= 40
                          ? 'bg-green-400 text-white border-green-500'
                          : 'bg-green-300 text-green-900 border-green-400'
                      }`}
                    >
                      Influence: {researcher.influence}%
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 max-h-[60vh] overflow-y-auto">
            {/* Advisor */}
            {researcher.advisor && (
              <div className="space-y-3">
                <div className="flex items-center space-x-2 text-base text-muted-foreground">
                  <GraduationCap className="w-5 h-5" />
                  <span className="font-semibold">Advisor</span>
                </div>
                <p className="text-base text-foreground ml-7">{researcher.advisor}</p>
              </div>
            )}

            {/* About */}
            {researcher.about && (
              <div className="space-y-3">
                <div className="flex items-center space-x-2 text-base text-muted-foreground">
                  <User className="w-5 h-5" />
                  <span className="font-semibold">About</span>
                </div>
                <div className="ml-7">
                  {(() => {
                    const ABOUT_PREVIEW_CHARS = 220;
                    const aboutText = researcher.about || '';
                    const isTruncated = aboutText.length > ABOUT_PREVIEW_CHARS;
                    const displayedAbout = showFullAbout 
                      ? aboutText 
                      : aboutText.slice(0, ABOUT_PREVIEW_CHARS) + (isTruncated ? '…' : '');
                    return (
                      <>
                        <p className="text-base text-foreground leading-relaxed inline">{displayedAbout}</p>
                        {isTruncated && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground align-baseline ml-1"
                            onClick={() => setShowFullAbout(prev => !prev)}
                          >
                            {showFullAbout ? 'Show less' : 'Read more'}
                          </Button>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}


            {/* Labs */}
            {researcher.labs && researcher.labs.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center space-x-2 text-base text-muted-foreground">
                  <Building2 className="w-5 h-5" />
                  <span className="font-semibold">Labs</span>
                </div>
                <div className="flex flex-wrap gap-2 ml-7">
                  {researcher.labs.map((lab, index) => (
                    <Badge key={index} variant="outline" className="text-sm">
                      {lab}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {researcher.tags && researcher.tags.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center space-x-2 text-base text-muted-foreground">
                  <Tag className="w-5 h-5" />
                  <span className="font-semibold">Research Areas</span>
                </div>
                <div className="flex flex-wrap gap-2 ml-7">
                  {researcher.tags.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="text-sm">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}


            {/* Papers */}
            {researcher.papers && researcher.papers.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center space-x-2 text-base text-muted-foreground">
                  <FileText className="w-5 h-5" />
                  <span className="font-semibold">Publications ({researcher.papers.length})</span>
                </div>
                <div className="space-y-3 ml-7">
                  {researcher.papers
                    .sort((a, b) => b.year - a.year)
                    .map((paper, index) => (
                      <div 
                        key={index} 
                        className={`text-sm border-l-2 border-muted pl-4 py-2 transition-all duration-200 ${onPaperChat ? 'cursor-pointer hover:bg-muted/50 hover:border-primary/50 hover:pl-6 rounded' : ''}`}
                        onClick={onPaperChat ? () => onPaperChat(paper) : undefined}
                      >
                        <div className="font-medium text-foreground mb-1">
                          {paper.title}
                        </div>
                        <div className="flex items-center space-x-2 text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          <span className="text-xs">{paper.year}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 px-1 text-xs text-muted-foreground hover:text-foreground transition-all duration-200 hover:scale-110"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePdfClick(paper);
                            }}
                            disabled={loadingPdfs.has(paper.document_id)}
                          >
                            {loadingPdfs.has(paper.document_id) ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <ExternalLink className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Contact Information */}
            {researcher.contact_info && researcher.contact_info.length > 0 && (
              <div className="space-y-3">
                <Separator />
                <div className="space-y-3">
                  <h4 className="text-base font-semibold text-muted-foreground">Contact</h4>
                  <div className="space-y-2">
                    {researcher.contact_info.map((contact, index) => {
                      const contactInfo = formatContactInfo(contact);
                      const Icon = contactInfo.icon;
                      return (
                        <div key={index} className="flex items-center space-x-3 text-base">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                          <a
                            href={
                              contactInfo.type === 'email' 
                                ? `mailto:${contactInfo.value}`
                                : contactInfo.type === 'url'
                                ? contactInfo.value.startsWith('http') 
                                  ? contactInfo.value 
                                  : `https://${contactInfo.value}`
                                : contactInfo.type === 'phone'
                                ? `tel:${contactInfo.value}`
                                : '#'
                            }
                            className="text-primary hover:text-primary/80 hover:underline"
                            target={contactInfo.type === 'url' ? '_blank' : undefined}
                            rel={contactInfo.type === 'url' ? 'noopener noreferrer' : undefined}
                          >
                            {contactInfo.value}
                          </a>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Show message if no additional data */}
            {!researcher.advisor && !researcher.about && (!researcher.labs || researcher.labs.length === 0) && (!researcher.tags || researcher.tags.length === 0) && (!researcher.contact_info || researcher.contact_info.length === 0) && (!researcher.papers || researcher.papers.length === 0) && researcher.influence === undefined && (
              <div className="text-base text-muted-foreground italic text-center py-8">
                No additional information available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResearcherModal;
