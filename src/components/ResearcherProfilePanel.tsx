import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Mail, Phone, Globe, GraduationCap, Building2, User, FileText, Calendar, Tag, ExternalLink, Loader2 } from 'lucide-react';
import { type Researcher, type Paper, fetchPaperLabId } from '../services/dynamodb';

interface ResearcherProfilePanelProps {
  researcher: Researcher | null;
  isVisible: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onPaperChat?: (paper: Paper) => void;
}

const ResearcherProfilePanel: React.FC<ResearcherProfilePanelProps> = ({
  researcher,
  isVisible,
  onMouseEnter,
  onMouseLeave,
  onPaperChat,
}) => {
  const [loadingPdfs, setLoadingPdfs] = useState<Set<string>>(new Set());

  if (!researcher || !isVisible) return null;

  const handlePdfClick = async (paper: Paper) => {
    if (!paper.document_id) return;
    
    const documentId = paper.document_id;
    setLoadingPdfs(prev => new Set(prev).add(documentId));
    
    try {
      // Get lab_id for the paper
      const labId = await fetchPaperLabId(documentId);
      
      if (!labId) {
        console.error('No lab_id found for paper:', documentId);
        alert('PDF not available - lab information not found');
        return;
      }
      
      // Generate presigned URL
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/pdf/url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lab_id: labId, document_id: documentId }),
      });
      if (!response.ok) {
        throw new Error("Failed to generate PDF URL");
      }
      const data = await response.json();
      const pdfUrl = data.url;
      
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
      className={`fixed bottom-6 right-6 z-50 transition-all duration-500 ease-out ${
        isVisible 
          ? 'opacity-100 translate-y-0 scale-100' 
          : 'opacity-0 translate-y-6 scale-95 pointer-events-none'
      }`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <Card className="w-[560px] shadow-lg border bg-card/95 backdrop-blur-sm transition-all duration-300 hover:shadow-xl">
        <CardHeader className="pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-lg">
              {researcher.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg text-foreground truncate">
                {researcher.name}
              </h3>
              <div className="flex items-center space-x-2 mt-1">
                {researcher.standing && (
                  <Badge variant="secondary" className="text-xs">
                    {researcher.standing}
                  </Badge>
                )}
                {researcher.influence !== undefined && (
                  <Badge 
                    variant="secondary" 
                    className={`text-xs font-medium hover:!bg-inherit hover:!text-inherit ${
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

        <CardContent className="space-y-4">

          {/* Advisor */}
          {researcher.advisor && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <GraduationCap className="w-4 h-4" />
                <span className="font-medium">Advisor</span>
              </div>
              <p className="text-sm text-foreground ml-6">{researcher.advisor}</p>
            </div>
          )}


          {/* Labs */}
          {researcher.labs && researcher.labs.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Building2 className="w-4 h-4" />
                <span className="font-medium">Labs</span>
              </div>
              <div className="flex flex-wrap gap-1 ml-6">
                {researcher.labs.map((lab, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {lab}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {researcher.tags && researcher.tags.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Tag className="w-4 h-4" />
                <span className="font-medium">Research Areas</span>
              </div>
              <div className="flex flex-wrap gap-1 ml-6">
                {researcher.tags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}



          {/* Contact Information */}
          {researcher.contact_info && researcher.contact_info.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Contact</h4>
                <div className="space-y-2">
                  {researcher.contact_info.map((contact, index) => {
                    const contactInfo = formatContactInfo(contact);
                    const Icon = contactInfo.icon;
                    return (
                      <div key={index} className="flex items-center space-x-2 text-sm">
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
                          className="text-primary hover:text-primary/80 hover:underline truncate"
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
            </>
          )}

          {/* Show message if no additional data */}
          {!researcher.advisor && (!researcher.labs || researcher.labs.length === 0) && (!researcher.tags || researcher.tags.length === 0) && (!researcher.contact_info || researcher.contact_info.length === 0) && researcher.influence === undefined && (
            <div className="text-sm text-muted-foreground italic text-center py-4">
              No additional information available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ResearcherProfilePanel;
