// Type declarations for VR libraries

declare module 'aframe' {
  // A-Frame is imported for side effects only
  const aframe: any;
  export default aframe;
}

declare module '3d-force-graph-vr' {
  interface ForceGraphVRInstance {
    (element: HTMLElement): ForceGraphVRInstance;
    graphData(data: { nodes: any[]; links: any[] }): ForceGraphVRInstance;
    nodeLabel(accessor: string | ((node: any) => string)): ForceGraphVRInstance;
    nodeColor(accessor: string | ((node: any) => string)): ForceGraphVRInstance;
    nodeVal(accessor: string | number | ((node: any) => number)): ForceGraphVRInstance;
    nodeRelSize(size: number): ForceGraphVRInstance;
    nodeOpacity(opacity: number): ForceGraphVRInstance;
    linkColor(accessor: string | ((link: any) => string)): ForceGraphVRInstance;
    linkWidth(width: number | ((link: any) => number)): ForceGraphVRInstance;
    linkOpacity(opacity: number): ForceGraphVRInstance;
    backgroundColor(color: string): ForceGraphVRInstance;
    warmupTicks(ticks: number): ForceGraphVRInstance;
    cooldownTicks(ticks: number): ForceGraphVRInstance;
    _destructor?(): void;
  }

  function ForceGraphVR(): ForceGraphVRInstance;
  export default ForceGraphVR;
}

