import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

// Initialize DynamoDB client
const client = new DynamoDBClient({
  region: import.meta.env.VITE_AWS_REGION || 'us-west-2',
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID || '',
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY || '',
  },
});

const docClient = DynamoDBDocumentClient.from(client);

export interface Researcher {
  researcher_id: string;
  name: string;
  advisor?: string | null;
  contact_info?: string[];
  labs?: string[];
  standing?: string;
  papers?: Paper[];
  tags?: string[];
  influence?: number;
  about?: string;
}

export interface Lab {
  lab_id: string;
  name: string;
}

export interface LabInfo {
  lab_id: string;
  description?: string;
  faculty?: string[]; // list of researcher_id
}

export interface PaperEdge {
  researcher_one_id: string;
  researcher_two_id: string;
}

export interface AdvisorEdge {
  advisee_id: string;
  advisor_id: string;
}

export interface Library {
  researcher_id: string;
  document_id: string;
}

export interface Paper {
  document_id: string;
  title: string;
  year: number;
  tags?: string[];
  lab_id?: string;
}

export interface Metrics {
  researcher_id: string;
  influence?: number;
}

export interface Description {
  researcher_id: string;
  about?: string;
}

export interface GraphData {
  nodes: Array<{
    id: string;
    name: string;
    val: number;
    type?: 'researcher' | 'lab';
    // Additional fields for researcher nodes
    advisor?: string | null;
    contact_info?: string[];
    labs?: string[];
    standing?: string;
    papers?: Paper[];
    tags?: string[];
    influence?: number;
    about?: string;
  }>;
  links: Array<{
    source: string;
    target: string;
    type?: 'paper' | 'advisor' | 'researcher_lab';
  }>;
}

export class DynamoDBService {
  /**
   * Fetch all researchers from the researchers table
   */
  static async fetchResearchers(): Promise<Researcher[]> {
    try {
      const command = new ScanCommand({
        TableName: 'researchers',
      });

      const response = await docClient.send(command);
      return (response.Items as Researcher[]) || [];
    } catch (error) {
      console.error('Error fetching researchers:', error);
      throw error;
    }
  }

  /**
   * Fetch researchers by a list of researcher_ids (batched)
   */
  static async fetchResearchersByIds(researcherIds: string[]): Promise<Researcher[]> {
    if (!researcherIds || researcherIds.length === 0) return [];
    try {
      const { BatchGetCommand } = await import('@aws-sdk/lib-dynamodb');
      const batches = [] as string[][];
      for (let i = 0; i < researcherIds.length; i += 100) {
        batches.push(researcherIds.slice(i, i + 100));
      }
      const responses = await Promise.all(batches.map(batch => {
        const command = new BatchGetCommand({
          RequestItems: {
            'researchers': {
              Keys: batch.map(id => ({ researcher_id: id })),
            },
          },
        });
        return docClient.send(command);
      }));
      return responses.flatMap(r => (r.Responses?.researchers as Researcher[]) || []);
    } catch (error) {
      console.error('Error fetching researchers by ids:', error);
      return [];
    }
  }

  /**
   * Fetch all paper edges from the paper-edges table
   */
  static async fetchPaperEdges(): Promise<PaperEdge[]> {
    try {
      const command = new ScanCommand({
        TableName: 'paper-edges',
      });

      const response = await docClient.send(command);
      return (response.Items as PaperEdge[]) || [];
    } catch (error) {
      console.error('Error fetching paper edges:', error);
      throw error;
    }
  }

  /**
   * Fetch all advisor edges from the advisor_edges table
   */
  static async fetchAdvisorEdges(): Promise<AdvisorEdge[]> {
    try {
      const command = new ScanCommand({
        TableName: 'advisor_edges',
      });

      const response = await docClient.send(command);
      return (response.Items as AdvisorEdge[]) || [];
    } catch (error) {
      console.error('Error fetching advisor edges:', error);
      throw error;
    }
  }

  /**
   * Fetch lab-info entries for provided lab_ids; skips missing or empty faculty
   */
  static async fetchLabInfos(labIds: string[]): Promise<LabInfo[]> {
    if (!labIds || labIds.length === 0) return [];
    try {
      const { BatchGetCommand } = await import('@aws-sdk/lib-dynamodb');
      const batches: string[][] = [];
      for (let i = 0; i < labIds.length; i += 100) {
        batches.push(labIds.slice(i, i + 100));
      }
      const responses = await Promise.all(batches.map(batch => {
        const command = new BatchGetCommand({
          RequestItems: {
            'lab-info': {
              Keys: batch.map(id => ({ lab_id: id })),
            },
          },
        });
        return docClient.send(command);
      }));
      const items = responses.flatMap(r => (r.Responses?.['lab-info'] as LabInfo[]) || []);
      return items.filter(i => Array.isArray(i.faculty) && i.faculty.length > 0);
    } catch (error) {
      console.error('Error fetching lab-info:', error);
      return [];
    }
  }

  /**
   * Fuzzy matching function to map researcher lab names to lab IDs
   */
  private static fuzzyMatchLab(researcherLabName: string, labId: string, labName: string): number {
    const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    const normalizedResearcherLab = normalize(researcherLabName);
    const normalizedLabId = normalize(labId);
    const normalizedLabName = normalize(labName);
    
    // Check for exact matches
    if (normalizedResearcherLab === normalizedLabId || normalizedResearcherLab === normalizedLabName) {
      return 1.0;
    }
    
    // Check for substring matches
    if (normalizedResearcherLab.includes(normalizedLabId) || normalizedLabId.includes(normalizedResearcherLab)) {
      return 0.8;
    }
    
    if (normalizedResearcherLab.includes(normalizedLabName) || normalizedLabName.includes(normalizedResearcherLab)) {
      return 0.8;
    }
    
    // Check for partial word matches
    const researcherWords = normalizedResearcherLab.split(/(?=[A-Z])|[\s_-]+/).filter(w => w.length > 2);
    const labWords = [...normalizedLabId.split('_'), ...normalizedLabName.split(/(?=[A-Z])|[\s_-]+/)].filter(w => w.length > 2);
    
    let matchCount = 0;
    for (const word of researcherWords) {
      if (labWords.some(labWord => labWord.includes(word) || word.includes(labWord))) {
        matchCount++;
      }
    }
    
    return researcherWords.length > 0 ? matchCount / researcherWords.length : 0;
  }

  /**
   * Find the best matching lab for a researcher's lab name
   */
  private static findBestLabMatch(researcherLabName: string, labs: Lab[]): Lab | null {
    let bestMatch: Lab | null = null;
    let bestScore = 0.3; // Minimum threshold for matching
    
    for (const lab of labs) {
      const score = this.fuzzyMatchLab(researcherLabName, lab.lab_id, lab.name);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = lab;
      }
    }
    
    return bestMatch;
  }

  /**
   * Fetch library entries for a researcher
   */
  static async fetchLibraryEntries(researcherId: string): Promise<Library[]> {
    try {
      if (!researcherId) {
        return [];
      }

      const command = new ScanCommand({
        TableName: 'library',
        FilterExpression: 'researcher_id = :researcher_id',
        ExpressionAttributeValues: {
          ':researcher_id': researcherId,
        },
      });

      const response = await docClient.send(command);
      return (response.Items as Library[]) || [];
    } catch (error) {
      console.error('Error fetching library entries:', error);
      // Return empty array instead of throwing to prevent UI crashes
      return [];
    }
  }

  /**
   * Fetch papers by document IDs
   */
  static async fetchPapers(documentIds: string[]): Promise<Paper[]> {
    if (!documentIds || documentIds.length === 0) return [];

    try {
      const { BatchGetCommand } = await import('@aws-sdk/lib-dynamodb');
      
      const command = new BatchGetCommand({
        RequestItems: {
          'papers': {
            Keys: documentIds.map(id => ({ document_id: id })),
          },
        },
      });

      const response = await docClient.send(command);
      return (response.Responses?.papers as Paper[]) || [];
    } catch (error) {
      console.error('Error fetching papers:', error);
      // Return empty array instead of throwing to prevent UI crashes
      return [];
    }
  }

  /**
   * Fetch lab_id for a specific paper by document_id
   * This assumes there's a lab_id field in the papers table
   */
  static async fetchPaperLabId(documentId: string): Promise<string | null> {
    try {
      const { GetCommand } = await import('@aws-sdk/lib-dynamodb');
      
      const command = new GetCommand({
        TableName: 'papers',
        Key: { document_id: documentId },
        ProjectionExpression: 'lab_id',
      });

      const response = await docClient.send(command);
      return response.Item?.lab_id || null;
    } catch (error) {
      console.error('Error fetching paper lab_id:', error);
      return null;
    }
  }

  /**
   * Fetch descriptions by researcher IDs (batched to handle >100 items)
   */
  static async fetchDescriptions(researcherIds: string[]): Promise<Description[]> {
    if (!researcherIds || researcherIds.length === 0) return [];

    try {
      const { BatchGetCommand } = await import('@aws-sdk/lib-dynamodb');
      
      // Split into batches of 100 (DynamoDB limit)
      const batches = [];
      for (let i = 0; i < researcherIds.length; i += 100) {
        batches.push(researcherIds.slice(i, i + 100));
      }

      // Process all batches in parallel
      const batchPromises = batches.map(batch => {
        const command = new BatchGetCommand({
          RequestItems: {
            'descriptions': {
              Keys: batch.map(id => ({ researcher_id: id })),
            },
          },
        });
        return docClient.send(command);
      });

      const responses = await Promise.all(batchPromises);
      
      // Combine all responses
      const allDescriptions = responses.flatMap(response => response.Responses?.descriptions || []);
      
      return allDescriptions.map(desc => ({
        researcher_id: desc.researcher_id,
        about: desc.about || '',
      }));
    } catch (error) {
      console.error('Error fetching descriptions:', error);
      // Return empty array instead of throwing to prevent UI crashes
      return [];
    }
  }

  /**
   * Fetch metrics by researcher IDs (batched to handle >100 items)
   */
  static async fetchMetrics(researcherIds: string[]): Promise<Metrics[]> {
    if (!researcherIds || researcherIds.length === 0) return [];

    try {
      const { BatchGetCommand } = await import('@aws-sdk/lib-dynamodb');
      
      // Split into batches of 100 (DynamoDB limit)
      const batches = [];
      for (let i = 0; i < researcherIds.length; i += 100) {
        batches.push(researcherIds.slice(i, i + 100));
      }

      // Process all batches in parallel
      const batchPromises = batches.map(batch => {
        const command = new BatchGetCommand({
          RequestItems: {
            'metrics': {
              Keys: batch.map(id => ({ researcher_id: id })),
            },
          },
        });
        return docClient.send(command);
      });

      const responses = await Promise.all(batchPromises);
      
      // Combine all responses
      const allMetrics = responses.flatMap(response => response.Responses?.metrics || []);
      
      return allMetrics.map(metric => {
        // Handle potential undefined or null values
        const influence = metric.influence;
        const parsedInfluence = influence !== undefined && influence !== null 
          ? Number(influence) 
          : undefined;
        
        // Validate that the parsed influence is a valid number
        if (parsedInfluence !== undefined && (isNaN(parsedInfluence) || parsedInfluence < 0 || parsedInfluence > 100)) {
          console.warn(`Invalid influence value for researcher ${metric.researcher_id}:`, influence);
          return {
            researcher_id: metric.researcher_id,
            influence: undefined
          };
        }
        
        return {
          researcher_id: metric.researcher_id,
          influence: parsedInfluence
        };
      });
    } catch (error) {
      console.error('Error fetching metrics:', error);
      // Return empty array instead of throwing to prevent UI crashes
      return [];
    }
  }

  /**
   * Get lab data (hardcoded for now)
   */
  static getLabs(): Lab[] {
    return [
      { lab_id: 'aims_lab', name: 'AIMS Lab' },
      { lab_id: 'behavioral_data_science_group', name: 'Behavioral Data Science Group' },
      { lab_id: 'bespoke_silicon_group', name: 'Bespoke Silicon Group' },
      { lab_id: 'database_group', name: 'Database Group' },
      { lab_id: 'h2_lab', name: 'H2 Lab' },
      { lab_id: 'human_centered_robotics_lab', name: 'Human-Centered Robotics Lab' },
      { lab_id: 'ictd_lab', name: 'Information and Communication Technology for Development (ICTD) Lab' },
      { lab_id: 'interactive_data_lab', name: 'Interactive Data Lab' },
      { lab_id: 'make4all_group', name: 'Make4all Group' },
      { lab_id: 'makeability_lab', name: 'Makeability Lab' },
      { lab_id: 'molecular_information_systems_lab', name: 'Molecular Information Systems Lab (MISL)' },
      { lab_id: 'mostafavi_lab', name: 'Mostafavi Lab' },
      { lab_id: 'personal_robotics_lab', name: 'Personal Robotics Lab' },
      { lab_id: 'raivn_lab', name: 'RAIVN Lab' },
      { lab_id: 'robot_learning_lab', name: 'Robot Learning Lab' },
      { lab_id: 'sampl', name: 'SAMPL' },
      { lab_id: 'social_futures_lab', name: 'Social Futures Lab' },
      { lab_id: 'social_rl_lab', name: 'Social RL Lab' },
      { lab_id: 'snail_lab', name: 'Systems Neuroscience & AI Lab (SNAIL)' },
      { lab_id: 'theory_of_computation_group', name: 'Theory of Computation Group' },
      { lab_id: 'tsvetshop', name: 'Tsvetshop' },
      { lab_id: 'ubicomp_lab', name: 'UbiComp Lab' },
      { lab_id: 'uw_reality_lab', name: 'UW Reality Lab' },
      { lab_id: 'weird_lab', name: 'WEIRD Lab' },
      { lab_id: 'wildlab', name: 'Wildlab' },
    ];
  }

  /**
   * Fetch all data and transform it into graph format
   */
  static async fetchGraphData(): Promise<GraphData> {
    try {
      const [researchers, paperEdges, advisorEdges] = await Promise.all([
        this.fetchResearchers(),
        this.fetchPaperEdges(),
        this.fetchAdvisorEdges(),
      ]);

      // Fetch metrics and descriptions for all researchers
      const researcherIds = researchers.map(r => r.researcher_id);
      const [metrics, descriptions] = await Promise.all([
        this.fetchMetrics(researcherIds),
        this.fetchDescriptions(researcherIds)
      ]);
      
      const metricsMap = new Map<string, number>();
      metrics.forEach(metric => {
        metricsMap.set(metric.researcher_id, metric.influence);
      });

      const descriptionsMap = new Map<string, Description>();
      descriptions.forEach(desc => {
        descriptionsMap.set(desc.researcher_id, desc);
      });

      // Get lab data
      const labs = this.getLabs();

      // Create a map of researcher_id to researcher for quick lookup
      const researcherMap = new Map<string, Researcher>();
      researchers.forEach(researcher => {
        researcherMap.set(researcher.researcher_id, researcher);
      });

      // Transform researchers into nodes (include full researcher data)
      const researcherNodes = await Promise.all(researchers.map(async researcher => {
        // Fetch papers for this researcher
        const libraryEntries = await this.fetchLibraryEntries(researcher.researcher_id);
        const documentIds = libraryEntries.map(entry => entry.document_id);
        const papers = await this.fetchPapers(documentIds);
        
        // Extract unique tags from all papers
        const allTags = papers
          .flatMap(paper => paper.tags || [])
          .filter((tag, index, array) => array.indexOf(tag) === index) // Remove duplicates
          .sort();
        
        // Get description data for this researcher
        const description = descriptionsMap.get(researcher.researcher_id);
        
        return {
          id: researcher.researcher_id,
          name: researcher.name,
          val: 1, // Default value for node size
          type: 'researcher' as const,
          // Include all researcher fields for the profile panel
          advisor: researcher.advisor,
          contact_info: researcher.contact_info,
          labs: researcher.labs,
          standing: researcher.standing,
          papers: papers,
          tags: allTags,
          influence: metricsMap.get(researcher.researcher_id),
          about: description?.about,
        };
      }));

      // Transform labs into nodes
      const labNodes = labs.map(lab => ({
        id: lab.lab_id,
        name: lab.name,
        val: 2, // Larger size for lab nodes
        type: 'lab' as const,
      }));

      // Combine all nodes
      const nodes = [...researcherNodes, ...labNodes];

      // Transform paper edges into undirected links
      const paperLinks = paperEdges
        .filter(edge => {
          const sourceExists = researcherMap.has(edge.researcher_one_id);
          const targetExists = researcherMap.has(edge.researcher_two_id);
          return sourceExists && targetExists;
        })
        .map(edge => ({
          source: edge.researcher_one_id,
          target: edge.researcher_two_id,
          type: 'paper' as const,
        }));

      // Transform advisor edges into directed links
      const advisorLinks = advisorEdges
        .filter(edge => {
          const sourceExists = researcherMap.has(edge.advisee_id);
          const targetExists = researcherMap.has(edge.advisor_id);
          return sourceExists && targetExists;
        })
        .map(edge => ({
          source: edge.advisee_id,
          target: edge.advisor_id,
          type: 'advisor' as const,
        }));

      // Create researcher-to-lab links for researchers without advisors
      const researcherLabLinks: Array<{ source: string; target: string; type: 'researcher_lab' }> = [];
      
      for (const researcher of researchers) {
        // Only connect researchers who don't have an advisor
        if (!researcher.advisor && researcher.labs && researcher.labs.length > 0) {
          for (const researcherLabName of researcher.labs) {
            const matchedLab = this.findBestLabMatch(researcherLabName, labs);
            if (matchedLab) {
              researcherLabLinks.push({
                source: researcher.researcher_id,
                target: matchedLab.lab_id,
                type: 'researcher_lab' as const,
              });
            }
          }
        }
      }

      // Combine all links
      const links = [...paperLinks, ...advisorLinks, ...researcherLabLinks];

      return { nodes, links };
    } catch (error) {
      console.error('Error fetching graph data:', error);
      throw error;
    }
  }
}
