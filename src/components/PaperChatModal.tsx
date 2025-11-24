import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { X, Send, Bot, User, FileText } from 'lucide-react';
import { type Paper } from '../services/dynamodb';

interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  citations?: Array<{
    text: string;
    source?: string;
  }>;
}

interface PaperChatModalProps {
  paper: Paper | null;
  isOpen: boolean;
  onClose: () => void;
}

const PaperChatModal: React.FC<PaperChatModalProps> = ({
  paper,
  isOpen,
  onClose,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Reset messages when paper changes (only if it's a different paper)
  useEffect(() => {
    if (paper) {
      setMessages([]);
    }
  }, [paper?.document_id]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || !paper || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      content: inputValue.trim(),
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => {
      const newMessages = [...prev, userMessage];
      console.log('Adding user message, total messages:', newMessages.length);
      return newMessages;
    });
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/rag/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: inputValue.trim(), document_id: paper.document_id }),
      });

      if (!response.ok) {
        throw new Error(`RAG chat failed: ${response.status}`);
      }

      const ragResponse = await response.json();

      // Format citations for display
      const formattedCitations: Array<{ text: string; source?: string }> = [];
      if (ragResponse.citations) {
        ragResponse.citations.forEach((citation: any) => {
          if (citation.retrievedReferences) {
            citation.retrievedReferences.forEach((ref: any) => {
              formattedCitations.push({
                text: ref.content?.text || '',
                source: ref.location?.s3Location?.uri || 'Unknown source',
              });
            });
          }
        });
      }

      const botMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: ragResponse.answer,
        isUser: false,
        timestamp: new Date(),
        citations: formattedCitations,
      };

      setMessages(prev => {
        const newMessages = [...prev, botMessage];
        console.log('Adding bot message, total messages:', newMessages.length);
        return newMessages;
      });
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isUser: false,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  if (!paper || !isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-200">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm opacity-100 animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative z-10 w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
        <Card className="shadow-2xl border bg-card flex flex-col h-[80vh] transition-all duration-200">
          {/* Header */}
          <CardHeader className="pb-4 relative flex-shrink-0">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 hover:bg-muted rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex items-center space-x-3 pr-12">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-xl text-foreground truncate">
                  Chat with Paper
                </h2>
                <p className="text-sm text-muted-foreground truncate">
                  {paper.title.replace(/^ATK:\s*/, '')}
                </p>
                <div className="flex items-center space-x-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {paper.year}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    ID: {paper.document_id}
                  </Badge>
                </div>
              </div>
            </div>
          </CardHeader>

          <Separator />

          {/* Messages */}
          <CardContent className="flex-1 overflow-hidden flex flex-col p-0">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">Start a conversation</p>
                  <p className="text-sm">
                    Ask questions about this paper and I'll help you understand it better.
                  </p>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg p-3 overflow-hidden ${
                        message.isUser
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      <div className="flex items-start space-x-2">
                        {!message.isUser && (
                          <Bot className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        )}
                        {message.isUser && (
                          <User className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm whitespace-pre-wrap break-words overflow-wrap-anywhere">
                            {message.content}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg p-3">
                    <div className="flex items-center space-x-2">
                      <Bot className="w-4 h-4" />
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex-shrink-0 p-4 border-t bg-muted/50">
              <div className="flex space-x-2">
                <Input
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask a question about this paper..."
                  disabled={isLoading}
                  className="flex-1"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isLoading}
                  size="sm"
                >
                  <Send className="w-4 h-4" />
                </Button>
                {messages.length > 0 && (
                  <Button
                    onClick={clearChat}
                    variant="outline"
                    size="sm"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PaperChatModal;
