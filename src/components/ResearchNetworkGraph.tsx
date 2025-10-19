import React, { useEffect, useRef, useState, useCallback } from 'react';
import ForceGraph3D from '3d-force-graph';
import SpriteText from 'three-spritetext';
import * as THREE from 'three';
import { DynamoDBService, type GraphData, type Researcher, type Paper } from '../services/dynamodb';
import ResearcherProfilePanel from './ResearcherProfilePanel';
import ResearcherModal from './ResearcherModal';
import SearchBar from './SearchBar';
import RecommendationsModal from './RecommendationsModal';
import { bedrockRAGService } from '@/services/bedrock';
import PaperChatModal from './PaperChatModal';
import LabModal from './LabModal';
import AccessibilityPanel from './AccessibilityPanel';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import { Settings } from 'lucide-react';

interface ResearchNetworkGraphProps {
  className?: string;
}

const ResearchNetworkGraph: React.FC<ResearchNetworkGraphProps> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Accessibility
  const { settings } = useAccessibility();
  const [showAccessibilityPanel, setShowAccessibilityPanel] = useState(false);
  
  // Profile panel state
  const [hoveredResearcher, setHoveredResearcher] = useState<Researcher | null>(null);
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const hoverTimeoutRef = useRef<number | null>(null);
  const panelHoverRef = useRef(false);

  // Modal state
  const [selectedResearcher, setSelectedResearcher] = useState<Researcher | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Search and highlighting state
  const [highlightedNodes, setHighlightedNodes] = useState<string[]>([]);

  // Paper chat state
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [showPaperChat, setShowPaperChat] = useState(false);

  // Recommendations state
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [recommendations, setRecommendations] = useState<Array<{ name: string; score: number; rationale?: string }>>([]);
  const [isRecommending, setIsRecommending] = useState(false);

  // Lab modal state
  const [openLabId, setOpenLabId] = useState<string | null>(null);
  const [openLabName, setOpenLabName] = useState<string | null>(null);
  const [labInfo, setLabInfo] = useState<any | null>(null);
  const [labFaculty, setLabFaculty] = useState<Researcher[]>([]);

  const openLabWithData = useCallback(async (labId: string, labName: string) => {
    setOpenLabId(labId);
    setOpenLabName(labName);
    try {
      const { DynamoDBService } = await import('@/services/dynamodb');
      const infos = await DynamoDBService.fetchLabInfos([labId]);
      const info = infos[0] || null;
      setLabInfo(info);
      if (info && Array.isArray(info.faculty) && info.faculty.length > 0) {
        const faculty = await DynamoDBService.fetchResearchersByIds(info.faculty);
        setLabFaculty(faculty);
      } else {
        setLabFaculty([]);
      }
    } catch (e) {
      console.error('Failed to load lab-info:', e);
      setLabInfo(null);
      setLabFaculty([]);
    }
  }, []);

  // Debounced hover handler
  const handleNodeHover = useCallback((node: any) => {
    // Clear existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    if (node && node.type === 'researcher') {
      // Debounce hover by 150ms
      hoverTimeoutRef.current = setTimeout(() => {
        if (!panelHoverRef.current) {
          console.log('Setting hovered researcher:', node);
          console.log('Researcher data:', {
            name: node.name,
            advisor: node.advisor,
            contact_info: node.contact_info,
            labs: node.labs,
            standing: node.standing
          });
          setHoveredResearcher(node);
          setShowProfilePanel(true);
        }
      }, 150);
    } else {
      // No node hovered or not a researcher
      hoverTimeoutRef.current = setTimeout(() => {
        if (!panelHoverRef.current) {
          setShowProfilePanel(false);
          setHoveredResearcher(null);
        }
      }, 200);
    }
  }, []);

  // Panel hover handlers
  const handlePanelMouseEnter = useCallback(() => {
    panelHoverRef.current = true;
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
  }, []);

  const handlePanelMouseLeave = useCallback(() => {
    panelHoverRef.current = false;
    hoverTimeoutRef.current = setTimeout(() => {
      setShowProfilePanel(false);
      setHoveredResearcher(null);
    }, 300);
  }, []);

  // Modal handlers
  const handleNodeClick = useCallback(async (node: any) => {
    if (!node) return;
    if (node.type === 'researcher') {
      setSelectedResearcher(node);
      setShowModal(true);
    } else if (node.type === 'lab') {
      openLabWithData(node.id, node.name);
    }
  }, [openLabWithData]);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setSelectedResearcher(null);
  }, []);

  // Search handlers
  const handleNodeSelect = useCallback((node: any) => {
    if (!node) return;
    if (node.type === 'lab') {
      openLabWithData(node.id, node.name);
      return;
    }
    setSelectedResearcher(node);
    setShowModal(true);
  }, [openLabWithData]);

  const handleHighlightNodes = useCallback((nodeIds: string[]) => {
    setHighlightedNodes(nodeIds);
  }, []);

  // Paper chat handlers
  const handlePaperChat = useCallback((paper: Paper) => {
    setSelectedPaper(paper);
    setShowPaperChat(true);
  }, []);

  const handleClosePaperChat = useCallback(() => {
    setShowPaperChat(false);
    setSelectedPaper(null);
  }, []);

  // Map names to researcher records for clickable navigation
  const nameToResearcherId = React.useMemo(() => {
    const map = new Map<string, string>();
    if (graphData) {
      for (const n of graphData.nodes) {
        if (n.type === 'researcher') {
          // Graph node id is the researcher_id
          map.set(n.name, n.id);
        }
      }
    }
    return map;
  }, [graphData]);

  const handleOpenResearcherById = useCallback((researcherId: string) => {
    if (!graphData) return;
    const node = graphData.nodes.find(n => n.id === researcherId);
    if (node) {
      setSelectedResearcher(node as any);
      setShowModal(true);
    }
  }, [graphData]);

  const handleResumeParsed = useCallback(async (text: string) => {
    try {
      setIsRecommending(true);
      let recs = await bedrockRAGService.recommendResearchersFromResume(text);
      if (!recs || recs.length === 0) {
        // Fallback: local similarity using tags and about fields
        if (graphData) {
          const lcResume = text.toLowerCase();
          const scored = graphData.nodes
            .filter(n => n.type === 'researcher')
            .map(n => {
              const tags = (n.tags || []).join(' ').toLowerCase();
              const about = (n.about || '').toLowerCase();
              // simple Jaccard-like overlap on words
              const resumeWords = new Set(lcResume.split(/[^a-z0-9]+/).filter(Boolean));
              const textWords = new Set((tags + ' ' + about).split(/[^a-z0-9]+/).filter(Boolean));
              let overlap = 0;
              for (const w of resumeWords) {
                if (textWords.has(w)) overlap++;
              }
              const denom = Math.max(1, resumeWords.size + textWords.size - overlap);
              const score = overlap / denom;
              return { name: n.name, score, rationale: undefined };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);
          recs = scored;
        } else {
          recs = [];
        }
      }
      setRecommendations(recs);
      setShowRecommendations(true);
    } catch (e) {
      console.error('Failed generating recommendations:', e);
      setRecommendations([]);
      setShowRecommendations(true);
    } finally {
      setIsRecommending(false);
    }
  }, [graphData]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await DynamoDBService.fetchGraphData();
        setGraphData(data);
      } catch (err) {
        console.error('Failed to fetch graph data:', err);
        setError('Failed to load research network data. Please check your AWS credentials and try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (!containerRef.current || !graphData) return;

    // Clean up existing graph
    if (graphRef.current) {
      graphRef.current._destructor();
    }

    // Initialize the 3D force graph
    const graph = new ForceGraph3D(containerRef.current)
      .graphData(graphData)
      .d3AlphaDecay(0.01) // Slower decay for more stable layout
      .d3VelocityDecay(0.3) // Higher velocity decay for less movement
      .cooldownTicks(100) // More ticks for better initial positioning
      .nodeThreeObject((node: any) => {
        // Create a group to hold both the shape and text
        const group = new THREE.Group();
        
        // Check if node is highlighted
        const isHighlighted = highlightedNodes.includes(node.id);
        
        // Create different shapes for different node types
        let shape;
        if (node.type === 'lab') {
          // Lab nodes: Box shape with blue color
          const geometry = new THREE.BoxGeometry(6, 6, 6);
          const material = new THREE.MeshBasicMaterial({ 
            color: isHighlighted ? '#00ff00' : '#2563eb' // Neon green when highlighted
          });
          shape = new THREE.Mesh(geometry, material);
        } else {
          // Researcher nodes: Sphere shape with gray color
          const geometry = new THREE.SphereGeometry(3, 16, 16);
          const material = new THREE.MeshBasicMaterial({ 
            color: isHighlighted ? '#00ff00' : '#1f2937' // Neon green when highlighted
          });
          shape = new THREE.Mesh(geometry, material);
        }
        group.add(shape);
        
        // Create text sprite
        const sprite = new SpriteText(node.name);
        sprite.color = isHighlighted ? '#00ff00' : (node.type === 'lab' ? '#2563eb' : '#1f2937');
        sprite.textHeight = node.type === 'lab' ? 8 : 6;
        sprite.position.y = node.type === 'lab' ? 10 : 8; // Position text above the shape
        group.add(sprite);
        
        return group;
      })
      .linkColor((link: any) => {
        if (link.type === 'advisor') return '#dc2626'; // Red for advisor
        if (link.type === 'researcher_lab') return '#059669'; // Green for researcher-to-lab
        return '#6b7280'; // Gray for paper
      })
      .linkWidth((link: any) => {
        if (link.type === 'advisor') return 1; // Very thin for advisor arrows
        if (link.type === 'researcher_lab') return 2; // Normal for researcher-to-lab
        return 2; // Normal for paper
      })
      .linkDirectionalArrowLength((link: any) => {
        if (link.type === 'advisor') return 4; // Arrows for advisor links
        if (link.type === 'researcher_lab') return 3; // Arrows for researcher-to-lab links
        return 0; // No arrows for paper links
      })
      .linkDirectionalArrowColor((link: any) => {
        if (link.type === 'advisor') return '#dc2626'; // Red arrows for advisor
        if (link.type === 'researcher_lab') return '#059669'; // Green arrows for researcher-to-lab
        return '#6b7280'; // Gray for paper
      })
      .linkDirectionalArrowRelPos(1) // Arrow at the end of the link
      .linkCurvature((link: any) => {
        if (link.type === 'advisor') return 0.25; // Curved arrows for advisor links
        if (link.type === 'researcher_lab') return 0.15; // Slightly curved for researcher-to-lab
        return 0; // Straight for paper links
      })
      .backgroundColor('#ffffff') // White background
      .showNavInfo(false)
      .enableNodeDrag(true)
      .onNodeHover(handleNodeHover)
      .onNodeClick(handleNodeClick);


    // Store reference for cleanup
    graphRef.current = graph;

    // Handle window resize
    const handleResize = () => {
      if (graphRef.current) {
        graphRef.current.width(window.innerWidth);
        graphRef.current.height(window.innerHeight);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (graphRef.current) {
        graphRef.current._destructor();
      }
    };
  }, [graphData]);

  // Separate effect for updating node highlighting without re-rendering the graph
  useEffect(() => {
    if (!graphRef.current) return;

    // Update node colors without recreating the entire graph
    graphRef.current.nodeThreeObject((node: any) => {
      // Create a group to hold both the shape and text
      const group = new THREE.Group();
      
      // Check if node is highlighted
      const isHighlighted = highlightedNodes.includes(node.id);
      
      // Create different shapes for different node types
      let shape;
      if (node.type === 'lab') {
        // Lab nodes: Box shape with blue color
        const geometry = new THREE.BoxGeometry(6, 6, 6);
        const material = new THREE.MeshBasicMaterial({ 
          color: isHighlighted ? '#00ff00' : '#2563eb' // Neon green when highlighted
        });
        shape = new THREE.Mesh(geometry, material);
      } else {
        // Researcher nodes: Sphere shape with gray color
        const geometry = new THREE.SphereGeometry(3, 16, 16);
        const material = new THREE.MeshBasicMaterial({ 
          color: isHighlighted ? '#00ff00' : '#1f2937' // Neon green when highlighted
        });
        shape = new THREE.Mesh(geometry, material);
      }
      group.add(shape);
      
      // Create text sprite
      const sprite = new SpriteText(node.name);
      sprite.color = isHighlighted ? '#00ff00' : (node.type === 'lab' ? '#2563eb' : '#1f2937');
      sprite.textHeight = node.type === 'lab' ? 8 : 6;
      sprite.position.y = node.type === 'lab' ? 10 : 8; // Position text above the shape
      group.add(sprite);
      
      return group;
    });
  }, [highlightedNodes]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-center">
          {/* Logo */}
          <div className="mb-6">
            <img 
              src="/favicon.jpeg" 
              alt="Paper Pigeon" 
              className="w-16 h-16 mx-auto mb-4 opacity-90"
            />
          </div>
          
          {/* App Name */}
          <h1 className="text-3xl font-light text-gray-700 tracking-wide mb-2">
            Paper Pigeon
          </h1>
          
          {/* Subtitle */}
          <p className="text-gray-500 text-sm mb-8">
            Research Network Visualization
          </p>
          
          {/* Loading indicator */}
          <div className="flex items-center justify-center space-x-2">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
          </div>
          
          <p className="text-gray-400 text-xs mt-4">
            Loading research network...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error Loading Data</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`w-full h-screen bg-white ${className}`}
      data-high-contrast={settings.highContrast}
      data-colorblind={settings.colorblindMode}
      data-reduced-motion={settings.reducedMotion}
    >
      {/* Skip to content link */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      
      <div ref={containerRef} className="w-full h-full" id="main-content" />
      
      {/* Accessibility Panel Toggle */}
      <button
        onClick={() => setShowAccessibilityPanel(!showAccessibilityPanel)}
        className="fixed top-6 right-6 z-40 p-2 rounded-full bg-white/95 backdrop-blur border shadow hover:shadow-lg transition-all duration-200 focus-visible"
        aria-label="Toggle accessibility settings"
        title="Accessibility Settings"
      >
        <Settings className="w-5 h-5" />
      </button>
      
      {showAccessibilityPanel && (
        <div className="fixed top-6 right-20 z-40">
          <AccessibilityPanel />
        </div>
      )}
      
      <SearchBar
        graphData={graphData}
        onNodeSelect={handleNodeSelect}
        onHighlightNodes={handleHighlightNodes}
        onResumeParsed={handleResumeParsed}
      />
      {isRecommending && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50">
          <div className="px-4 py-2 rounded-full bg-white/95 backdrop-blur border shadow flex items-center gap-3">
            <div className="relative">
              <span className="block w-2 h-2 rounded-full bg-primary shadow-[0_0_6px_rgba(59,130,246,0.7)]" />
              <span className="absolute inset-0 rounded-full bg-primary/40 animate-ping" />
            </div>
            <span className="text-sm text-foreground">Finding recommended researchers…</span>
          </div>
        </div>
      )}
      {showRecommendations && (
        <RecommendationsModal
          isOpen={showRecommendations}
          onClose={() => setShowRecommendations(false)}
          recommendations={recommendations}
          onClickResearcher={handleOpenResearcherById}
          nameToResearcherId={nameToResearcherId}
        />
      )}
        <ResearcherProfilePanel
          researcher={hoveredResearcher}
          isVisible={showProfilePanel}
          onMouseEnter={handlePanelMouseEnter}
          onMouseLeave={handlePanelMouseLeave}
          onPaperChat={handlePaperChat}
        />
      <ResearcherModal
        researcher={selectedResearcher}
        isOpen={showModal}
        onClose={handleCloseModal}
        onPaperChat={handlePaperChat}
      />
      <PaperChatModal
        paper={selectedPaper}
        isOpen={showPaperChat}
        onClose={handleClosePaperChat}
      />
      <LabModal
        labId={openLabId}
        labName={openLabName}
        isOpen={Boolean(openLabId)}
        onClose={() => {
          setOpenLabId(null);
          setOpenLabName(null);
          setLabInfo(null);
          setLabFaculty([]);
        }}
        labInfo={labInfo}
        faculty={labFaculty}
        onClickResearcher={handleOpenResearcherById}
      />
    </div>
  );
};

export default ResearchNetworkGraph;
