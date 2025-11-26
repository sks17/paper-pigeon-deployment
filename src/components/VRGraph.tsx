import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { GraphData } from '../services/dynamodb';

// Import aframe before 3d-force-graph-vr
import 'aframe';
import ForceGraphVR from '3d-force-graph-vr';

interface VRGraphProps {
  graphData: GraphData | null;
  loading?: boolean;
}

const VRGraph: React.FC<VRGraphProps> = ({ graphData, loading = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !graphData) return;

    try {
      // Clean up existing graph
      if (graphRef.current) {
        graphRef.current._destructor?.();
        graphRef.current = null;
      }

      // Clear container completely
      containerRef.current.innerHTML = '';
      
      // Pre-position nodes near the origin for visibility
      const positionedNodes = graphData.nodes.map((node: any) => ({
        ...node,
        x: (Math.random() - 0.5) * 100,
        y: (Math.random() - 0.5) * 100,
        z: (Math.random() - 0.5) * 100 - 200, // Position nodes in front of camera
      }));
      
      const positionedData = {
        nodes: positionedNodes,
        links: graphData.links
      };

      // Initialize VR graph
      const graph = ForceGraphVR()(containerRef.current);
      
      // Configure graph settings
      graph
        .graphData(positionedData)
        .nodeLabel((node: any) => node.name || node.id)
        .nodeColor((node: any) => {
          if (node.type === 'lab') return '#00ff00'; // Bright green for labs
          return '#00aaff'; // Bright cyan for researchers  
        })
        .nodeVal((node: any) => {
          const baseVal = node.val || 5;
          return node.type === 'lab' ? baseVal * 4 : baseVal * 2;
        })
        .nodeRelSize(8) // Large base node size
        .nodeOpacity(1)
        .linkColor(() => '#ffffff')
        .linkWidth(2)
        .linkOpacity(0.8)
        .backgroundColor('#000011') // Dark blue background
        .warmupTicks(100) // Let simulation run before rendering
        .cooldownTicks(0); // Disable further simulation

      graphRef.current = graph;
      setIsInitialized(true);
      setError(null);
      
      console.log('VR Graph initialized with', positionedNodes.length, 'nodes');
    } catch (err) {
      console.error('VR Graph initialization failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize VR mode');
    }

    return () => {
      if (graphRef.current) {
        graphRef.current._destructor?.();
        graphRef.current = null;
      }
    };
  }, [graphData]);

  // Loading state
  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white">Loading VR Graph...</p>
        </div>
      </div>
    );
  }

  // No data state
  if (!graphData) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-black">
        <div className="text-center p-8 bg-gray-800 rounded-lg max-w-md">
          <div className="text-yellow-500 text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-white mb-2">No Graph Data</h2>
          <p className="text-gray-400 mb-4">Graph data is required for VR mode.</p>
          <Link
            to="/"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Return to 3D View
          </Link>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-black">
        <div className="text-center p-8 bg-red-900/50 border border-red-500 rounded-lg max-w-md">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-white mb-2">VR Mode Error</h2>
          <p className="text-red-300 mb-4">{error}</p>
          <p className="text-gray-400 text-sm mb-4">
            VR mode requires WebXR support. Please use a compatible browser or VR headset.
          </p>
          <Link
            to="/"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Return to 3D View
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen relative bg-black">
      {/* Exit VR button */}
      <div className="absolute top-4 left-4 z-50">
        <Link
          to="/"
          className="px-4 py-2 bg-gray-800/80 hover:bg-gray-700 text-white rounded-lg border border-gray-600 transition-colors flex items-center gap-2"
        >
          <span>←</span>
          <span>Exit VR Mode</span>
        </Link>
      </div>
      
      {/* Status indicator */}
      <div className="absolute top-4 right-4 z-50">
        <div className={`px-3 py-1 rounded-full text-sm ${isInitialized ? 'bg-green-600' : 'bg-yellow-600'} text-white`}>
          {isInitialized ? `✓ ${graphData?.nodes?.length || 0} nodes loaded` : 'Initializing...'}
        </div>
      </div>

      {/* VR Graph container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* VR instructions */}
      <div className="absolute bottom-4 left-4 z-50 text-white/70 text-sm bg-black/50 p-3 rounded-lg max-w-xs">
        <p className="font-semibold mb-1">VR Controls:</p>
        <ul className="text-xs space-y-1">
          <li>• Use WASD keys to move around</li>
          <li>• Click and drag to rotate view</li>
          <li>• Scroll to zoom in/out</li>
          <li>• Nodes are positioned around origin</li>
        </ul>
      </div>
    </div>
  );
};

export default VRGraph;

