import { CSS2DRenderer, CSS2DObject } from 'https://esm.sh/three/examples/jsm/renderers/CSS2DRenderer.js';

// Load ForceGraph3D from CDN
const script = document.createElement('script');
script.src = 'https://unpkg.com/3d-force-graph@1.70.15/dist/3d-force-graph.min.js';
script.onload = async () => {
  // ForceGraph3D is available globally after script loads
  const ForceGraph3D = window.ForceGraph3D;
  
  // Fetch graph data
  let graphData;
  try {
    const response = await fetch('./data.json');
    graphData = await response.json();
  } catch (error) {
    console.error('Failed to load data.json:', error);
    return;
  }
  
  // Create CSS2D renderer
  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0';
  labelRenderer.domElement.style.pointerEvents = 'none';
  document.body.appendChild(labelRenderer.domElement);
  
  // Initialize the 3D force graph
  const container = document.getElementById('graph');
  const graph = ForceGraph3D()(container)
    .graphData(graphData)
    .nodeThreeObject((node) => {
      // Create label element exactly matching production
      const el = document.createElement('div');
      el.textContent = node.name || node.id;
      el.className = 'node-label';
      return new CSS2DObject(el);
    })
    .nodeThreeObjectExtend(true)
    .backgroundColor('#ffffff')
    .showNavInfo(false)
    .enableNodeDrag(true);
  
  // Update label renderer on each frame
  const animate = () => {
    requestAnimationFrame(animate);
    labelRenderer.render(graph.scene(), graph.camera());
  };
  animate();
  
  // Handle window resize
  window.addEventListener('resize', () => {
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    graph.width(window.innerWidth);
    graph.height(window.innerHeight);
  });
};

document.head.appendChild(script);

