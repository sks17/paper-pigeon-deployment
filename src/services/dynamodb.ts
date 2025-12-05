/**
 * Frontend API Client for Graph Data.
 *
 * This service handles all communication with the backend API.
 * Note: Despite the filename, this does NOT directly access DynamoDB.
 * All data flows through the Flask backend API.
 */

// ============================================================================
// Type Definitions
// ============================================================================

export interface Paper {
  title: string;
  year: number;
  document_id: string;
  tags: string[];
}

export interface Researcher {
  id: string;
  name: string;
  type: 'researcher';
  val: number;
  advisor?: string;
  contact_info?: string[];
  labs?: string[];
  standing?: string;
  papers?: Paper[];
  tags?: string[];
  influence?: number;
  about?: string;
}

export interface LabInfo {
  lab_id: string;
  description?: string;
  faculty?: string[];
}

export interface Node {
  id: string;
  name: string;
  type: 'researcher' | 'lab';
  val: number;
  [key: string]: any;
}

export interface Link {
  source: string;
  target: string;
  type: string;
}

export interface GraphData {
  nodes: Node[];
  links: Link[];
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetches the complete graph data from the backend.
 * Returns pre-computed nodes and links for the 3D visualization.
 */
export async function fetchGraphData(): Promise<GraphData> {
  const url = '/api/graph/data';
  
  const res = await fetch(url);
  
  if (!res.ok) {
    throw new Error(`Failed to fetch graph data: ${res.status} ${res.statusText}`);
  }
  
  return await res.json();
}

/**
 * Resolves a paper's document_id to its associated lab_id.
 * Used for constructing S3 paths for PDF access.
 */
export async function fetchPaperLabId(documentId: string): Promise<string | null> {
  const res = await fetch('/api/graph/paper-lab-id', {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ document_id: documentId }),
  });

  if (!res.ok) throw new Error("Failed to fetch lab_id for paper");

  const data = await res.json();
  return data.lab_id || null;
}

// ============================================================================
// Legacy Service Object (Stub)
// ============================================================================

/**
 * Legacy service object maintained for backwards compatibility.
 * New code should use the standalone functions above.
 */
export const DynamoDBService = {
  /** Stub - lab info is embedded in graph data, no separate fetch needed */
  async fetchLabInfos(_labIds: string[]): Promise<LabInfo[]> {
    return [];
  }
};
