import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, Building2, X, Bird, Plus } from 'lucide-react';
import { type GraphData } from '../services/dynamodb';
import { Button } from '@/components/ui/button';
import { parsePdf } from '@/services/pdf';

interface SearchBarProps {
  graphData: GraphData | null;
  onNodeSelect: (node: any) => void;
  onHighlightNodes: (nodeIds: string[]) => void;
  onResumeParsed?: (text: string) => void;
}

interface SearchResult {
  id: string;
  name: string;
  type: 'researcher' | 'lab';
  labs?: string[];
  standing?: string;
  tags?: string[];
}

const SearchBar: React.FC<SearchBarProps> = ({
  graphData,
  onNodeSelect,
  onHighlightNodes,
  onResumeParsed,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<number | null>(null);
  const highlightTimeoutRef = useRef<number | null>(null);

  // Fast search for dropdown results
  const searchNodes = useCallback((query: string) => {
    if (!graphData || !query.trim()) {
      setSearchResults([]);
      return;
    }

    const normalizedQuery = query.toLowerCase().trim();
    const results: SearchResult[] = [];

    // Search through all nodes
    graphData.nodes.forEach(node => {
      const nodeName = node.name.toLowerCase();
      const matchesName = nodeName.includes(normalizedQuery);
      const matchesLab = node.labs?.some(lab => 
        lab.toLowerCase().includes(normalizedQuery)
      ) || false;
      const matchesTag = node.tags?.some(tag => 
        tag.toLowerCase().includes(normalizedQuery)
      ) || false;

      if (matchesName || matchesLab || matchesTag) {
        results.push({
          id: node.id,
          name: node.name,
          type: node.type || 'researcher',
          labs: node.labs,
          standing: node.standing,
          tags: node.tags,
        });
      }
    });

    // Sort results: exact name matches first, then lab matches, then tag matches
    results.sort((a, b) => {
      const aNameMatch = a.name.toLowerCase().includes(normalizedQuery);
      const bNameMatch = b.name.toLowerCase().includes(normalizedQuery);
      const aLabMatch = a.labs?.some(lab => lab.toLowerCase().includes(normalizedQuery)) || false;
      const bLabMatch = b.labs?.some(lab => lab.toLowerCase().includes(normalizedQuery)) || false;
      const aTagMatch = a.tags?.some(tag => tag.toLowerCase().includes(normalizedQuery)) || false;
      const bTagMatch = b.tags?.some(tag => tag.toLowerCase().includes(normalizedQuery)) || false;
      
      // Name matches first
      if (aNameMatch && !bNameMatch) return -1;
      if (!aNameMatch && bNameMatch) return 1;
      
      // Then lab matches
      if (aLabMatch && !bLabMatch) return -1;
      if (!aLabMatch && bLabMatch) return 1;
      
      // Then tag matches
      if (aTagMatch && !bTagMatch) return -1;
      if (!aTagMatch && bTagMatch) return 1;
      
      return a.name.localeCompare(b.name);
    });

    setSearchResults(results.slice(0, 10)); // Limit to 10 results
  }, [graphData]);

  // Separate function for highlighting with longer debounce
  const highlightNodes = useCallback((query: string) => {
    if (!graphData || !query.trim()) {
      onHighlightNodes([]);
      return;
    }

    const normalizedQuery = query.toLowerCase().trim();
    const highlightedIds: string[] = [];

    graphData.nodes.forEach(node => {
      const nodeName = node.name.toLowerCase();
      const matchesName = nodeName.includes(normalizedQuery);
      const matchesLab = node.labs?.some(lab => 
        lab.toLowerCase().includes(normalizedQuery)
      ) || false;
      const matchesTag = node.tags?.some(tag => 
        tag.toLowerCase().includes(normalizedQuery)
      ) || false;


      if (matchesName || matchesLab || matchesTag) {
        highlightedIds.push(node.id);
      }
    });

    onHighlightNodes(highlightedIds);
  }, [graphData, onHighlightNodes]);

  // Handle input change with debounce for search results only
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    setSelectedIndex(-1);
    setShowDropdown(query.length > 0);

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // If search is empty, clear highlighting immediately
    if (query.trim() === '') {
      onHighlightNodes([]);
    }

    // Fast debounce for search results (200ms)
    searchTimeoutRef.current = setTimeout(() => {
      searchNodes(query);
    }, 200);
  };

  // Handle result selection
  const handleResultSelect = (result: SearchResult) => {
    const node = graphData?.nodes.find(n => n.id === result.id);
    if (node) {
      onNodeSelect(node);
      setSearchQuery('');
      setShowDropdown(false);
      setSelectedIndex(-1);
    }
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (showDropdown && selectedIndex >= 0 && selectedIndex < searchResults.length) {
        // Select the highlighted result
        handleResultSelect(searchResults[selectedIndex]);
      } else {
        // Highlight nodes based on current search query
        if (searchQuery.trim()) {
          highlightNodes(searchQuery);
        }
      }
      return;
    }

    if (!showDropdown) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < searchResults.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : searchResults.length - 1
        );
        break;
      case 'Escape':
        setShowDropdown(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  // Clear search
  const clearSearch = () => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    setSearchQuery('');
    setSearchResults([]);
    setShowDropdown(false);
    setSelectedIndex(-1);
    onHighlightNodes([]);
    inputRef.current?.focus();
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowDropdown(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isParsingResume, setIsParsingResume] = useState(false);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file.');
      return;
    }
    try {
      setIsParsingResume(true);
      const text = await parsePdf(file);
      if (text && text.length > 0) {
        // Notify parent for downstream RAG recommendation
        // (Parent can ignore if not provided)
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        (typeof onResumeParsed === 'function') && onResumeParsed(text);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsParsingResume(false);
      // reset input so same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed top-6 left-6 z-40 w-[500px]">
      {/* Search Bar */}
      <div className="relative">
        <div className="flex items-center space-x-3 bg-white/95 backdrop-blur-sm rounded-full shadow-lg border px-6 py-3 transition-all duration-200 hover:shadow-xl focus-within:ring-2 focus-within:ring-primary/30">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <Bird className="w-5 h-5 text-white" />
            </div>
          </div>

          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={searchQuery}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Search researchers, labs, or tags..."
              className="pl-10 pr-10 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-muted rounded"
              >
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Resume Upload */}
          <div className="relative">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleFileSelected}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleUploadClick}
              disabled={isParsingResume}
              className="rounded-full"
              aria-label="Upload resume PDF"
              title="Upload resume (PDF)"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Dropdown Results */}
        {showDropdown && searchResults.length > 0 && (
          <Card ref={dropdownRef} className="absolute top-full left-0 right-0 mt-2 shadow-xl border-0 bg-white/95 backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-300">
            <CardContent className="p-2">
              <div className="space-y-1">
                {searchResults.map((result, index) => (
                  <div
                    key={result.id}
                    onClick={() => handleResultSelect(result)}
                    className={`flex items-center space-x-3 p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                      index === selectedIndex
                        ? 'bg-primary/10 border border-primary/20 scale-[1.02]'
                        : 'hover:bg-muted/50 hover:scale-[1.01]'
                    }`}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex-shrink-0">
                      {result.type === 'researcher' ? (
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold">
                          {result.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold">
                          <Building2 className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-foreground truncate">
                        {result.name}
                      </div>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {result.type === 'researcher' ? 'Researcher' : 'Lab'}
                        </Badge>
                        {result.standing && (
                          <Badge variant="secondary" className="text-xs">
                            {result.standing}
                          </Badge>
                        )}
                      </div>
                       <div className="text-xs text-muted-foreground mt-1 space-y-1">
                         {result.labs && result.labs.length > 0 && (
                           <div className="truncate">
                             <span className="font-medium">Labs:</span> {result.labs.join(', ')}
                           </div>
                         )}
                         {result.tags && result.tags.length > 0 && (
                           <div className="truncate">
                             <span className="font-medium">Tags:</span> {result.tags.slice(0, 3).join(', ')}
                             {result.tags.length > 3 && ` +${result.tags.length - 3} more`}
                           </div>
                         )}
                       </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* No Results */}
        {showDropdown && searchQuery && searchResults.length === 0 && (
          <Card className="absolute top-full left-0 right-0 mt-2 shadow-xl border-0 bg-white/95 backdrop-blur-sm">
            <CardContent className="p-4 text-center">
              <div className="text-sm text-muted-foreground">
                No results found for "{searchQuery}"
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default SearchBar;
