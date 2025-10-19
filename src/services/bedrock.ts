import { BedrockAgentRuntimeClient, RetrieveAndGenerateCommand } from '@aws-sdk/client-bedrock-agent-runtime';

// Initialize Bedrock client
const bedrockClient = new BedrockAgentRuntimeClient({
  region: import.meta.env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
  },
});

export interface RAGResponse {
  answer: string;
  citations: Array<{
    retrievedReferences: Array<{
      content: {
        text: string;
      };
      location: {
        type: string;
        s3Location?: {
          uri: string;
        };
      };
    }>;
  }>;
}

export interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  citations?: Array<{
    text: string;
    source?: string;
  }>;
}

export class BedrockRAGService {
  private knowledgeBaseId: string;
  private dataSourceId: string;
  private modelId: string;
  private knowledgeBaseId2?: string;
  private dataSourceId2?: string;

  // Available model options for RAG:
  // - meta.llama3-1-70b-instruct-v1:0 (Recommended: Best for RAG, strong reasoning)
  // - mistral.mistral-7b-instruct-v0:2 (Fast and cost-effective)
  // - amazon.titan-text-large-v1 (AWS native, reliable)
  // - anthropic.claude-3-sonnet-20240229-v1:0 (Original Claude, if preferred)

  constructor() {
    this.knowledgeBaseId = import.meta.env.VITE_BEDROCK_KNOWLEDGE_BASE_ID;
    this.dataSourceId = import.meta.env.VITE_BEDROCK_DATA_SOURCE_ID;
    this.knowledgeBaseId2 = import.meta.env.VITE_BEDROCK_KNOWLEDGE_BASE_ID_2;
    this.dataSourceId2 = import.meta.env.VITE_BEDROCK_DATA_SOURCE_ID_2;
    // Default to Llama 3.1 70B if no model ID is provided
    this.modelId = import.meta.env.VITE_BEDROCK_MODEL_ID || 'meta.llama3-1-70b-instruct-v1:0';

    if (!this.knowledgeBaseId || !this.dataSourceId) {
      throw new Error('Missing required Bedrock environment variables');
    }
  }

  async retrieveAndGenerate(
    query: string,
    documentId: string
  ): Promise<RAGResponse> {
    try {
      const command = new RetrieveAndGenerateCommand({
        input: {
          text: query,
        },
        retrieveAndGenerateConfiguration: {
          type: 'KNOWLEDGE_BASE',
          knowledgeBaseConfiguration: {
            knowledgeBaseId: this.knowledgeBaseId,
            modelArn: `arn:aws:bedrock:${import.meta.env.VITE_AWS_REGION}::foundation-model/${this.modelId}`,
            retrievalConfiguration: {
              vectorSearchConfiguration: {
                numberOfResults: 5,
                overrideSearchType: 'HYBRID',
                filter: {
                  equals: {
                    key: 'document_id',
                    value: documentId,
                  },
                },
              },
            },
          },
        },
      });

      const response = await bedrockClient.send(command);
      
      if (!response.output || !response.citations) {
        throw new Error('Invalid response from Bedrock');
      }

      // Parse the response
      const answer = response.output.text || 'No answer generated';
      const citations = response.citations || [];

      return {
        answer,
        citations: citations.map(citation => ({
          retrievedReferences: citation.retrievedReferences?.map(ref => ({
            content: {
              text: ref.content?.text || '',
            },
            location: {
              type: ref.location?.type || 'unknown',
              s3Location: ref.location?.s3Location ? {
                uri: ref.location.s3Location.uri || 'Unknown URI'
              } : undefined,
            },
          })) || [],
        })),
      };
    } catch (error) {
      console.error('Error in Bedrock RAG:', error);
      throw new Error(`Failed to retrieve and generate: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Helper method to format citations for display
  formatCitations(citations: RAGResponse['citations']): Array<{ text: string; source?: string }> {
    const formattedCitations: Array<{ text: string; source?: string }> = [];
    
    citations.forEach(citation => {
      citation.retrievedReferences.forEach(ref => {
        formattedCitations.push({
          text: ref.content.text,
          source: ref.location.s3Location?.uri || 'Unknown source',
        });
      });
    });

    return formattedCitations;
  }

  /**
   * Recommend researchers to contact based on parsed resume text and optional context array.
   * Returns normalized list of { name, score, rationale }.
   */
  async recommendResearchersFromResume(
    resumeText: string,
    contextSnippets: Array<{ title?: string; text: string }> = []
  ): Promise<Array<{ name: string; score: number; rationale?: string }>> {
    const instruction = [
      'You are a research outreach assistant. Given a candidate resume, identify the top 5 researchers in the knowledge base who are the best fit to contact.',
      'Output JSON ONLY with the schema: { "recommendations": [ { "name": string, "score": number, "rationale": string } ] }.',
      'Score must be 0.0 - 1.0 reflecting semantic fit and mutual interests. Do not include any extra text.',
    ].join(' ');

    const stitchedContext = contextSnippets
      .map(s => `${s.title ? `Title: ${s.title}\n` : ''}${s.text}`)
      .join('\n\n');

    const prompt = [
      instruction,
      'RESUME:\n"""',
      resumeText.slice(0, 12000), // keep prompt small enough
      '"""',
      stitchedContext ? `\n\nADDITIONAL CONTEXT:\n"""\n${stitchedContext.slice(0, 6000)}\n"""` : '',
      '\nReturn JSON only.'
    ].join('\n');

    const kbId = this.knowledgeBaseId2 || this.knowledgeBaseId;
    const command = new RetrieveAndGenerateCommand({
      input: { text: prompt },
      retrieveAndGenerateConfiguration: {
        type: 'KNOWLEDGE_BASE',
        knowledgeBaseConfiguration: {
          knowledgeBaseId: kbId,
          modelArn: `arn:aws:bedrock:${import.meta.env.VITE_AWS_REGION}::foundation-model/${this.modelId}`,
          retrievalConfiguration: {
            vectorSearchConfiguration: {
              numberOfResults: 25,
              overrideSearchType: 'HYBRID',
            },
          },
        },
      },
    });

    const response = await bedrockClient.send(command);
    const text = response.output?.text || '';
    try {
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed?.recommendations) ? parsed.recommendations : [];
      type RawRec = { name?: unknown; score?: unknown; rationale?: unknown };
      return (list as RawRec[])
        .map((r: RawRec) => ({ name: String(r.name || '').trim(), score: Number(r.score ?? 0), rationale: r.rationale ? String(r.rationale) : undefined }))
        .filter(r => r.name)
        .slice(0, 10);
    } catch (e) {
      console.warn('Non-JSON Bedrock response for recommendations; returning empty list. Body:', text);
      return [];
    }
  }
}

// Export singleton instance
export const bedrockRAGService = new BedrockRAGService();
