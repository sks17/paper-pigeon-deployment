import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import SpriteText from 'three-spritetext';
import * as THREE from 'three';
import { fetchGraphData, type GraphData } from '../services/dynamodb';
import { useAccessibility } from '@/contexts/AccessibilityContext';

interface VRResearchNetworkGraphProps {
  className?: string;
}

const VRResearchNetworkGraph: React.FC<VRResearchNetworkGraphProps> = ({ className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vrSupported, setVrSupported] = useState(false);
  
  // Accessibility
  const { settings } = useAccessibility();
  
  // Search and highlighting state
  const [highlightedNodes] = useState<string[]>([]);

  // Check VR support
  useEffect(() => {
    const checkVRSupport = async () => {
      if ('xr' in navigator) {
        try {
          const isSupported = await (navigator as any).xr.isSessionSupported('immersive-vr');
          setVrSupported(isSupported);
        } catch (e) {
          console.warn('VR support check failed:', e);
          setVrSupported(false);
        }
      } else {
        setVrSupported(false);
      }
    };
    checkVRSupport();
  }, []);

  useEffect(() => {
    console.log("VRResearchNetworkGraph: useEffect triggered, calling fetchData");
    const fetchData = async () => {
      try {
        console.log("VRResearchNetworkGraph: Setting loading=true");
        setLoading(true);
        setError(null);
        console.log("VRResearchNetworkGraph: About to call fetchGraphData()");
        const data = await fetchGraphData();
        console.log("VRResearchNetworkGraph: fetchGraphData() returned, setting graphData");
        setGraphData(data);
      } catch (err) {
        console.error('VRResearchNetworkGraph: Failed to fetch graph data:', err);
        setError('Failed to load research network data. Please check your AWS credentials and try again.');
      } finally {
        console.log("VRResearchNetworkGraph: Setting loading=false");
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (!containerRef.current || !graphData) return;

    // Dynamically import ForceGraphVR to avoid breaking build if it fails
    import('3d-force-graph-vr').then((module) => {
      const ForceGraphVR = (module as any).default || (module as any).ForceGraphVR || (window as any).ForceGraphVR;
      
      if (!ForceGraphVR) {
        throw new Error('ForceGraphVR not available');
      }

      // Clean up existing graph
      if (graphRef.current) {
        try {
          graphRef.current._destructor();
        } catch (e) {
          console.warn('Error cleaning up graph:', e);
        }
      }

      // Initialize the VR force graph
      const graph = new ForceGraphVR(containerRef.current)
          .graphData(graphData)
          .d3AlphaDecay(0.01) // Same as main graph
          .d3VelocityDecay(0.3) // Same as main graph
          .cooldownTicks(100) // Same as main graph
          .nodeThreeObject((node: any) => {
            // Reuse exact same node rendering logic as main graph
            const group = new THREE.Group();
            
            // Check if node is highlighted
            const isHighlighted = highlightedNodes.includes(node.id);
            
            // Create different shapes for different node types (same as main graph)
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
            
            // Create text sprite (same as main graph, VR-compatible)
            const sprite = new SpriteText(node.name);
            sprite.color = isHighlighted ? '#00ff00' : (node.type === 'lab' ? '#2563eb' : '#1f2937');
            sprite.textHeight = node.type === 'lab' ? 8 : 6;
            sprite.position.y = node.type === 'lab' ? 10 : 8; // Position text above the shape
            group.add(sprite);
            
            return group;
          })
          .linkColor((link: any) => {
            // Same link colors as main graph
            if (link.type === 'advisor') return '#dc2626'; // Red for advisor
            if (link.type === 'researcher_lab') return '#059669'; // Green for researcher-to-lab
            return '#6b7280'; // Gray for paper
          })
          .linkWidth((link: any) => {
            // Same link widths as main graph
            if (link.type === 'advisor') return 1; // Very thin for advisor arrows
            if (link.type === 'researcher_lab') return 2; // Normal for researcher-to-lab
            return 2; // Normal for paper
          })
          .linkDirectionalArrowLength((link: any) => {
            // Same arrow lengths as main graph
            if (link.type === 'advisor') return 4; // Arrows for advisor links
            if (link.type === 'researcher_lab') return 3; // Arrows for researcher-to-lab links
            return 0; // No arrows for paper links
          })
          .linkDirectionalArrowColor((link: any) => {
            // Same arrow colors as main graph
            if (link.type === 'advisor') return '#dc2626'; // Red arrows for advisor
            if (link.type === 'researcher_lab') return '#059669'; // Green arrows for researcher-to-lab
            return '#6b7280'; // Gray for paper
          })
          .linkDirectionalArrowRelPos(1) // Arrow at the end of the link
          .linkCurvature((link: any) => {
            // Same curvature as main graph
            if (link.type === 'advisor') return 0.25; // Curved arrows for advisor links
            if (link.type === 'researcher_lab') return 0.15; // Slightly curved for researcher-to-lab
            return 0; // Straight for paper links
          })
          .backgroundColor('#ffffff') // White background
          .showNavInfo(false)
          .enableNodeDrag(true);

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
            try {
              graphRef.current._destructor();
            } catch (e) {
              console.warn('Error destroying graph:', e);
            }
          }
        };
      }).catch((importError) => {
        console.error('Failed to load ForceGraphVR:', importError);
        setError('VR mode is not available. Please ensure your browser supports WebXR.');
      });
  }, [graphData, highlightedNodes]);

  // Separate effect for updating node highlighting
  useEffect(() => {
    if (!graphRef.current) return;

    // Update node colors without recreating the entire graph
    graphRef.current.nodeThreeObject((node: any) => {
      const group = new THREE.Group();
      
      const isHighlighted = highlightedNodes.includes(node.id);
      
      let shape;
      if (node.type === 'lab') {
        const geometry = new THREE.BoxGeometry(6, 6, 6);
        const material = new THREE.MeshBasicMaterial({ 
          color: isHighlighted ? '#00ff00' : '#2563eb'
        });
        shape = new THREE.Mesh(geometry, material);
      } else {
        const geometry = new THREE.SphereGeometry(3, 16, 16);
        const material = new THREE.MeshBasicMaterial({ 
          color: isHighlighted ? '#00ff00' : '#1f2937'
        });
        shape = new THREE.Mesh(geometry, material);
      }
      group.add(shape);
      
      const sprite = new SpriteText(node.name);
      sprite.color = isHighlighted ? '#00ff00' : (node.type === 'lab' ? '#2563eb' : '#1f2937');
      sprite.textHeight = node.type === 'lab' ? 8 : 6;
      sprite.position.y = node.type === 'lab' ? 10 : 8;
      group.add(sprite);
      
      return group;
    });
  }, [highlightedNodes]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-center">
          <div className="mb-6">
            <img 
              src="/favicon.png" 
              alt="Paper Pigeon" 
              className="w-16 h-16 mx-auto mb-4 opacity-90"
            />
          </div>
          <h1 className="text-3xl font-light text-gray-700 tracking-wide mb-2">
            Paper Pigeon VR
          </h1>
          <p className="text-gray-500 text-sm mb-8">
            Loading VR experience...
          </p>
          <div className="flex items-center justify-center space-x-2">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">VR Mode Not Available</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <a
            href="/graph"
            className="inline-block px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Return to Standard View
          </a>
        </div>
      </div>
    );
  }

  if (!vrSupported) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-yellow-500 text-6xl mb-4">🥽</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">VR Not Supported</h2>
          <p className="text-gray-600 mb-4">
            Your browser or device does not support WebXR. Please use a compatible VR headset and browser.
          </p>
          <a
            href="/graph"
            className="inline-block px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Return to Standard View
          </a>
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
      <div ref={containerRef} className="w-full h-full" />
      
      {/* VR Toggle Button - Active state on VR page */}
      <Link
        to="/graph"
        className="fixed top-6 right-20 z-40 p-2 rounded-full bg-accent border-accent border shadow hover:shadow-lg transition-all duration-200 focus-visible font-semibold"
        aria-label="Return to standard view"
        title="Return to standard view"
      >
        <span className="text-sm font-medium">VR</span>
      </Link>
    </div>
  );
};

export default VRResearchNetworkGraph;

