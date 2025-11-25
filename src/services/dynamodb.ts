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

export async function fetchGraphData(): Promise<GraphData> {
  console.log("Calling fetchGraphData...");
  const baseUrl = import.meta.env.VITE_API_URL || '';
  const url = `${baseUrl}/api/graph/data`;
  console.log("Fetch URL:", url);
  console.log("Before fetch");
  
  try {
    const res = await fetch(url);
    console.log("After fetch - Response status:", res.status, res.statusText);
    console.log("Response headers:", Object.fromEntries(res.headers.entries()));
    
    if (!res.ok) {
      console.error("Response not OK:", res.status, res.statusText);
      throw new Error("Failed to fetch graph data");
    }
    
    const data = await res.json();
    console.log("Successfully parsed JSON response");
    return data;
  } catch (error) {
    console.error("Error in fetchGraphData:", error);
    throw error;
  }
}

export async function fetchPaperLabId(documentId: string): Promise<string | null> {
  const baseUrl = import.meta.env.VITE_API_URL || '';
  const res = await fetch(`${baseUrl}/api/graph/paper-lab-id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ document_id: documentId }),
  });

  if (!res.ok) throw new Error("Failed to fetch lab_id for paper");

  const data = await res.json();
  return data.lab_id || null;
}

export const DynamoDBService = {
  async fetchLabInfos(_labIds: string[]): Promise<LabInfo[]> {
    // Stub implementation - backend should handle this
    return [];
  }
};
