# Paper Pigeon - Complete Codebase Analysis

## Executive Summary

**Paper Pigeon** is a client-side React application for visualizing and exploring a research network. It provides a 3D interactive graph of researchers and labs, with features for searching, resume-based recommendations, paper chat (RAG), and detailed researcher/lab profiles. The application directly connects to AWS services (DynamoDB, S3, Bedrock) from the browser using AWS SDK v3.

**Architecture Type**: Single-Page Application (SPA) - **Frontend-only, no backend server**

---

## 1. File/Folder Structure

```
paper-pigeon/
├── src/
│   ├── main.tsx                    # React entry point
│   ├── App.tsx                     # Root component (wraps with AccessibilityProvider)
│   ├── App.css                     # Legacy CSS (mostly unused)
│   ├── index.css                   # Main stylesheet (Tailwind + accessibility)
│   │
│   ├── components/                 # React components
│   │   ├── ResearchNetworkGraph.tsx    # Main 3D graph visualization component
│   │   ├── SearchBar.tsx              # Search input with resume upload
│   │   ├── ResearcherProfilePanel.tsx # Hover panel for quick researcher info
│   │   ├── ResearcherModal.tsx        # Full researcher profile modal
│   │   ├── PaperChatModal.tsx         # RAG-powered paper Q&A modal
│   │   ├── RecommendationsModal.tsx    # Resume-based researcher recommendations
│   │   ├── LabModal.tsx               # Lab information modal
│   │   ├── AccessibilityPanel.tsx     # Accessibility settings panel
│   │   └── ui/                         # shadcn/ui components (button, card, input, etc.)
│   │
│   ├── services/                   # AWS service integrations
│   │   ├── dynamodb.ts            # DynamoDB data fetching service
│   │   ├── bedrock.ts             # Bedrock RAG service (paper chat + recommendations)
│   │   ├── s3.ts                   # S3 presigned URL generation for PDFs
│   │   └── pdf.ts                  # Client-side PDF parsing (pdfjs-dist)
│   │
│   ├── contexts/                   # React contexts
│   │   └── AccessibilityContext.tsx   # Accessibility settings state management
│   │
│   └── lib/                        # Utilities
│       └── utils.ts                # Tailwind class name merger (cn function)
│
├── package.json                    # Dependencies and scripts
├── vite.config.ts                 # Vite build configuration
├── tsconfig.json                  # TypeScript configuration
├── components.json                # shadcn/ui configuration
└── index.html                     # HTML entry point
```

---

## 2. Main Modules and Responsibilities

### 2.1 Core Application (`App.tsx`, `main.tsx`)
- **Entry Point**: `main.tsx` renders `App` component
- **App Component**: Wraps `ResearchNetworkGraph` with `AccessibilityProvider`
- **Purpose**: Minimal root component that provides accessibility context

### 2.2 Visualization Module (`ResearchNetworkGraph.tsx`)
**Primary Component** - ~560 lines
- **Responsibilities**:
  - Initializes 3D force graph using `3d-force-graph` library
  - Fetches graph data on mount via `DynamoDBService.fetchGraphData()`
  - Manages node hover/click interactions
  - Coordinates all modals and panels (researcher, lab, paper chat, recommendations)
  - Handles search highlighting and keyboard navigation
  - Integrates resume upload → RAG recommendations flow
- **State Management**: Local React state for graph data, modals, highlighting
- **Dependencies**: `3d-force-graph`, `three.js`, `three-spritetext`

### 2.3 Search Module (`SearchBar.tsx`)
**~410 lines**
- **Responsibilities**:
  - Real-time search with typeahead dropdown (researchers, labs, tags)
  - Keyboard navigation (arrow keys, Enter, Escape)
  - Resume PDF upload and parsing
  - Triggers graph node highlighting
  - Calls `onResumeParsed` callback for recommendations
- **Search Logic**: Client-side filtering on graph nodes (name, labs, tags)

### 2.4 Profile Display Modules
- **`ResearcherProfilePanel.tsx`**: Hover panel (quick view, ~230 lines)
- **`ResearcherModal.tsx`**: Full modal with all researcher details (~340 lines)
  - Shows: name, advisor, labs, tags, papers, contact info, influence score, about
  - Handles PDF opening via S3 presigned URLs
  - Triggers paper chat modal

### 2.5 RAG/Chat Module (`PaperChatModal.tsx`)
**~250 lines**
- **Responsibilities**:
  - Chat interface for asking questions about papers
  - Calls `bedrockRAGService.retrieveAndGenerate()` with document filter
  - Displays citations from Bedrock responses
  - Manages chat message history

### 2.6 Recommendations Module (`RecommendationsModal.tsx`)
**~125 lines**
- **Responsibilities**:
  - Displays resume-based researcher recommendations
  - Shows similarity scores (boosted for display)
  - Clickable researcher names to open profiles
- **Data Source**: `bedrockRAGService.recommendResearchersFromResume()`

### 2.7 Lab Module (`LabModal.tsx`)
**~115 lines**
- **Responsibilities**:
  - Displays lab information (description, faculty)
  - Fetches lab-info from DynamoDB on open
  - Clickable faculty members

### 2.8 Accessibility Module (`AccessibilityContext.tsx`, `AccessibilityPanel.tsx`)
- **Context**: Manages accessibility settings (localStorage persistence)
- **Settings**: High contrast, colorblind modes, reduced motion, font size
- **Panel**: UI for toggling accessibility options

---

## 3. Data Flow Architecture

### 3.1 Application Initialization Flow

```
1. main.tsx → App.tsx
2. App.tsx → AccessibilityProvider → ResearchNetworkGraph
3. ResearchNetworkGraph mounts:
   - Calls DynamoDBService.fetchGraphData()
   - Fetches: researchers, paper-edges, advisor_edges, metrics, descriptions
   - For each researcher: fetches library entries → papers
   - Transforms into graph nodes/links
   - Initializes 3D force graph
```

### 3.2 Data Fetching Flow (DynamoDB)

**Service**: `src/services/dynamodb.ts` (~605 lines)

**Tables Accessed**:
1. `researchers` - Researcher metadata (Scan)
2. `paper-edges` - Collaboration edges (Scan)
3. `advisor_edges` - Advisor-advisee relationships (Scan)
4. `library` - Researcher → document_id mappings (Scan with filter)
5. `papers` - Paper metadata (BatchGet)
6. `lab-info` - Lab descriptions and faculty (BatchGet)
7. `descriptions` - Researcher about text (BatchGet)
8. `metrics` - Researcher influence scores (BatchGet)

**Key Methods**:
- `fetchGraphData()`: Orchestrates all data fetching, returns `GraphData`
- `fetchResearchers()`: Scans `researchers` table
- `fetchLibraryEntries(researcherId)`: Gets papers for a researcher
- `fetchPapers(documentIds)`: Batch gets paper metadata
- `fetchLabInfos(labIds)`: Gets lab information
- `fetchMetrics(researcherIds)`: Gets influence scores
- `fetchDescriptions(researcherIds)`: Gets about text

**Data Transformation**:
- Researchers → nodes (type: 'researcher')
- Labs (hardcoded list) → nodes (type: 'lab')
- Paper edges → undirected links (type: 'paper')
- Advisor edges → directed links (type: 'advisor')
- Researcher-lab associations → links (type: 'researcher_lab')

### 3.3 RAG Flow (Bedrock)

**Service**: `src/services/bedrock.ts` (~208 lines)

**Two Use Cases**:

#### A. Paper Chat (`retrieveAndGenerate`)
```
User types question → PaperChatModal
  → bedrockRAGService.retrieveAndGenerate(query, documentId)
  → BedrockAgentRuntimeClient.send(RetrieveAndGenerateCommand)
  → Knowledge Base: VITE_BEDROCK_KNOWLEDGE_BASE_ID
  → Filter: document_id = {documentId}
  → Returns: answer + citations
  → Display in chat UI
```

#### B. Resume Recommendations (`recommendResearchersFromResume`)
```
User uploads PDF → SearchBar.parsePdf()
  → Extracts text (client-side)
  → bedrockRAGService.recommendResearchersFromResume(resumeText)
  → BedrockAgentRuntimeClient.send(RetrieveAndGenerateCommand)
  → Knowledge Base: VITE_BEDROCK_KNOWLEDGE_BASE_ID_2 (or fallback to primary)
  → Prompt: JSON schema request for recommendations
  → Parses JSON response → recommendations array
  → Fallback: If Bedrock fails, uses local Jaccard similarity on tags/about
  → Displays in RecommendationsModal
```

### 3.4 PDF Access Flow (S3)

**Service**: `src/services/s3.ts` (~73 lines)

```
User clicks paper PDF link → ResearcherModal/ResearcherProfilePanel
  → DynamoDBService.fetchPaperLabId(documentId)
  → s3Service.getPresignedPdfUrl(labId, documentId)
  → S3Client generates presigned URL (1 hour expiry)
  → Opens PDF in new tab
```

**S3 Structure**: `{labId}/{documentId}.pdf`

### 3.5 Resume Upload Flow

```
User selects PDF → SearchBar.handleFileSelected()
  → pdf.ts.parsePdf(file) [client-side, pdfjs-dist]
  → Extracts text from all pages
  → Calls onResumeParsed(text) callback
  → ResearchNetworkGraph.handleResumeParsed()
  → bedrockRAGService.recommendResearchersFromResume(text)
  → Opens RecommendationsModal with results
```

---

## 4. API Calls and AWS Interactions

### 4.1 AWS SDK Clients Initialization

**Location**: Service files initialize clients using environment variables

**Credentials Source**: 
- `import.meta.env.VITE_AWS_ACCESS_KEY_ID`
- `import.meta.env.VITE_AWS_SECRET_ACCESS_KEY`
- `import.meta.env.VITE_AWS_REGION`

**⚠️ SECURITY CONCERN**: AWS credentials are exposed in client-side code (Vite environment variables are bundled into the JavaScript bundle). This is a **critical security issue** for production.

### 4.2 DynamoDB Interactions

**Client**: `DynamoDBDocumentClient` (from `@aws-sdk/lib-dynamodb`)

**Operations**:
- **Scan**: `researchers`, `paper-edges`, `advisor_edges`, `library` (with filter)
- **BatchGet**: `papers`, `lab-info`, `descriptions`, `metrics`
- **Get**: `papers` (for lab_id lookup)

**Tables**:
1. `researchers` - Partition key: `researcher_id`
2. `paper-edges` - Partition key: `researcher_one_id`, Sort key: `researcher_two_id`
3. `advisor_edges` - Partition key: `advisee_id`, Sort key: `advisor_id`
4. `library` - Partition key: `researcher_id`, Sort key: `document_id` (inferred)
5. `papers` - Partition key: `document_id`
6. `lab-info` - Partition key: `lab_id`
7. `descriptions` - Partition key: `researcher_id`
8. `metrics` - Partition key: `researcher_id`

### 4.3 Bedrock Interactions

**Client**: `BedrockAgentRuntimeClient` (from `@aws-sdk/client-bedrock-agent-runtime`)

**Operations**:
- `RetrieveAndGenerateCommand` - Two configurations:
  1. Paper chat: Knowledge base with document filter
  2. Recommendations: Knowledge base with prompt engineering

**Knowledge Bases**:
- Primary: `VITE_BEDROCK_KNOWLEDGE_BASE_ID` (paper chat)
- Secondary: `VITE_BEDROCK_KNOWLEDGE_BASE_ID_2` (recommendations, optional)

**Model**: `VITE_BEDROCK_MODEL_ID` (defaults to `meta.llama3-1-70b-instruct-v1:0`)

### 4.4 S3 Interactions

**Client**: `S3Client` (from `@aws-sdk/client-s3`)

**Operations**:
- `GetObjectCommand` + `getSignedUrl()` - Generate presigned URLs for PDFs

**Bucket**: `VITE_S3_BUCKET_NAME`

**Key Pattern**: `{labId}/{documentId}.pdf`

---

## 5. Environment Variables

### Required Variables

```env
# AWS Credentials (⚠️ EXPOSED IN CLIENT BUNDLE)
VITE_AWS_REGION=us-west-2
VITE_AWS_ACCESS_KEY_ID=your_access_key
VITE_AWS_SECRET_ACCESS_KEY=your_secret_key

# Bedrock Configuration
VITE_BEDROCK_KNOWLEDGE_BASE_ID=primary_kb_id
VITE_BEDROCK_DATA_SOURCE_ID=primary_ds_id
VITE_BEDROCK_MODEL_ID=meta.llama3-1-70b-instruct-v1:0  # Optional

# Bedrock Recommendations (Optional)
VITE_BEDROCK_KNOWLEDGE_BASE_ID_2=recommendations_kb_id
VITE_BEDROCK_DATA_SOURCE_ID_2=recommendations_ds_id

# S3 Configuration
VITE_S3_BUCKET_NAME=your_bucket_name
```

**⚠️ Security Note**: All `VITE_*` variables are bundled into the client JavaScript. AWS credentials should **never** be in client-side code. Use a backend proxy or AWS Cognito for authentication.

---

## 6. Security-Relevant Code

### 6.1 Critical Security Issues

1. **AWS Credentials in Client Code**
   - **Location**: All service files (`dynamodb.ts`, `bedrock.ts`, `s3.ts`)
   - **Issue**: Access keys and secret keys are read from environment variables and bundled into the JavaScript bundle
   - **Risk**: Anyone can extract credentials from the browser's JavaScript bundle
   - **Mitigation Required**: 
     - Use AWS Cognito for authentication
     - Implement a backend API proxy
     - Use IAM roles with temporary credentials

2. **Direct DynamoDB Access from Browser**
   - **Location**: `src/services/dynamodb.ts`
   - **Issue**: Client directly scans/reads DynamoDB tables
   - **Risk**: No access control, potential data exposure, cost implications
   - **Mitigation**: Backend API with proper authorization

3. **S3 Presigned URLs**
   - **Location**: `src/services/s3.ts`
   - **Status**: ✅ Relatively safe (presigned URLs have expiration)
   - **Note**: URLs expire after 1 hour (configurable)

4. **Bedrock API Keys**
   - **Location**: `src/services/bedrock.ts`
   - **Issue**: Knowledge base IDs and model ARNs are exposed (less critical than credentials)
   - **Risk**: Potential abuse if combined with exposed credentials

### 6.2 Data Privacy Considerations

- **Resume Text**: Parsed client-side, sent to Bedrock for recommendations
- **Chat Messages**: Sent to Bedrock (may be logged by AWS)
- **User Data**: No user authentication/authorization implemented
- **CORS**: Application assumes CORS is configured for AWS services

---

## 7. Architectural Assumptions and Missing Backend Boundaries

### 7.1 Current Architecture Assumptions

1. **No Backend Server**: Application is purely client-side
2. **Direct AWS Access**: Assumes AWS services are accessible from browser
3. **CORS Configuration**: Assumes DynamoDB, Bedrock, S3 have CORS enabled
4. **IAM Permissions**: Assumes credentials have:
   - DynamoDB: Read access to all tables
   - Bedrock: Invoke model access + knowledge base access
   - S3: Read access to bucket
5. **Data Structure**: Assumes specific DynamoDB table schemas
6. **Lab Data**: Labs are hardcoded in `DynamoDBService.getLabs()` (not from database)

### 7.2 Missing Backend Boundaries

**What Should Be on Backend**:

1. **Authentication & Authorization**
   - User login/session management
   - Role-based access control
   - API key management

2. **AWS Credential Management**
   - Never expose AWS credentials to client
   - Use IAM roles or temporary credentials
   - Implement credential rotation

3. **Data Access Layer**
   - Backend API endpoints for:
     - Fetching graph data
     - Researcher/lab/paper queries
     - Search functionality
   - Implement caching, rate limiting, pagination

4. **RAG Service Proxy**
   - Backend endpoint for Bedrock calls
   - Implement request validation, rate limiting
   - Add conversation history storage

5. **Resume Processing**
   - Upload resume to backend
   - Process on server (more secure)
   - Store recommendations in database

6. **Analytics & Logging**
   - Track user interactions
   - Monitor API usage
   - Error logging

7. **Data Validation**
   - Validate all inputs before AWS calls
   - Sanitize user inputs
   - Prevent injection attacks

### 7.3 Recommended Backend Architecture

```
Frontend (React) → Backend API (Node.js/Express or AWS Lambda)
  ↓
Backend handles:
  - Authentication (AWS Cognito)
  - DynamoDB queries (with IAM roles)
  - Bedrock RAG calls
  - S3 presigned URL generation
  - Rate limiting, caching, validation
```

---

## 8. Data Models

### 8.1 Graph Data Structure

```typescript
interface GraphData {
  nodes: Array<{
    id: string;                    // researcher_id or lab_id
    name: string;
    val: number;                  // Node size (1 for researcher, 2 for lab)
    type: 'researcher' | 'lab';
    // Researcher-specific fields:
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
    source: string;                // Node ID
    target: string;                // Node ID
    type: 'paper' | 'advisor' | 'researcher_lab';
  }>;
}
```

### 8.2 DynamoDB Table Schemas

**researchers**:
- PK: `researcher_id` (String)
- Attributes: `name`, `advisor`, `contact_info[]`, `labs[]`, `standing`

**papers**:
- PK: `document_id` (String)
- Attributes: `title`, `year`, `tags[]`, `lab_id`

**library**:
- PK: `researcher_id` (String)
- SK: `document_id` (String, inferred)

**paper-edges**:
- PK: `researcher_one_id` (String)
- SK: `researcher_two_id` (String)

**advisor_edges**:
- PK: `advisee_id` (String)
- SK: `advisor_id` (String)

**lab-info**:
- PK: `lab_id` (String)
- Attributes: `description`, `faculty[]` (researcher_ids)

**descriptions**:
- PK: `researcher_id` (String)
- Attributes: `about` (String)

**metrics**:
- PK: `researcher_id` (String)
- Attributes: `influence` (Number, 0-100)

---

## 9. Technology Stack

### 9.1 Core Framework
- **React 19.1.1** - UI framework
- **TypeScript 5.9.3** - Type safety
- **Vite 7.1.7** - Build tool and dev server

### 9.2 UI Libraries
- **Tailwind CSS 4.1.14** - Styling
- **shadcn/ui** - Component library (Radix UI primitives)
- **lucide-react** - Icons
- **3d-force-graph 1.79.0** - 3D graph visualization
- **three.js 0.180.0** - 3D graphics
- **three-spritetext 1.10.0** - Text sprites for 3D graph

### 9.3 AWS SDK
- **@aws-sdk/client-bedrock-agent-runtime 3.913.0** - Bedrock RAG
- **@aws-sdk/client-dynamodb 3.913.0** - DynamoDB client
- **@aws-sdk/lib-dynamodb 3.913.0** - DynamoDB document client
- **@aws-sdk/client-s3 3.913.0** - S3 client
- **@aws-sdk/s3-request-presigner 3.913.0** - Presigned URLs

### 9.4 Utilities
- **pdfjs-dist 4.8.69** - Client-side PDF parsing
- **d3 7.9.0** - Data manipulation (used by 3d-force-graph)
- **clsx, tailwind-merge** - CSS class utilities

---

## 10. Key Features and User Flows

### 10.1 Research Network Visualization
- 3D interactive graph with researchers (spheres) and labs (boxes)
- Node colors: Gray (researchers), Blue (labs), Green (highlighted)
- Link colors: Gray (paper collaborations), Red (advisor), Green (researcher-lab)
- Interactions: Hover (profile panel), Click (full modal), Drag nodes

### 10.2 Search and Navigation
- Real-time search with dropdown
- Keyboard navigation (arrow keys, Enter)
- Graph highlighting for search matches
- Click to focus on nodes

### 10.3 Resume-Based Recommendations
- Upload PDF resume
- Client-side parsing
- Bedrock RAG for semantic matching
- Fallback to local Jaccard similarity
- Display top 10 recommendations with scores

### 10.4 Paper Chat (RAG)
- Click paper in researcher profile
- Ask questions about the paper
- Bedrock retrieves relevant chunks from knowledge base
- Responses include citations
- Chat history maintained in modal

### 10.5 Researcher Profiles
- Hover panel (quick view)
- Full modal (detailed view)
- Shows: name, advisor, labs, tags, papers, contact, influence, about
- Clickable papers → PDF or chat

### 10.6 Lab Profiles
- Click lab node to open modal
- Shows description and faculty
- Clickable faculty members

### 10.7 Accessibility
- High contrast mode
- Colorblind support (protanopia, deuteranopia, tritanopia)
- Reduced motion
- Font size adjustment
- Settings persisted in localStorage

---

## 11. Build and Deployment

### 11.1 Development
```bash
pnpm install
pnpm dev          # Vite dev server (http://localhost:5173)
```

### 11.2 Production Build
```bash
pnpm build        # Outputs to dist/
pnpm preview      # Preview production build
```

### 11.3 Deployment Considerations
- **Static Hosting**: Can be deployed to S3 + CloudFront, Vercel, Netlify
- **Environment Variables**: Must be set in hosting platform
- **CORS**: Must configure CORS for AWS services
- **Security**: ⚠️ **Do not deploy with exposed AWS credentials**

---

## 12. Known Limitations and Technical Debt

1. **Security**: AWS credentials exposed in client bundle
2. **Scalability**: Full table scans on every load (no pagination)
3. **Performance**: Fetches all data upfront (could be lazy-loaded)
4. **Error Handling**: Basic error handling, some silent failures
5. **Lab Data**: Hardcoded lab list (not from database)
6. **No Caching**: Every page load refetches all data
7. **No Offline Support**: Requires internet connection
8. **No User Authentication**: No user accounts or personalization
9. **Limited Search**: Client-side only, no full-text search
10. **PDF Parsing**: Client-side only (may fail on large/complex PDFs)

---

## 13. Recommendations for External Architectural Planning

### 13.1 Immediate Security Fixes
1. **Remove AWS credentials from client code**
2. **Implement backend API proxy**
3. **Use AWS Cognito for authentication**
4. **Add IAM role-based access control**

### 13.2 Backend API Design
Create RESTful API endpoints:
- `GET /api/graph-data` - Fetch graph data
- `GET /api/researchers/:id` - Get researcher details
- `GET /api/papers/:id` - Get paper details
- `POST /api/chat` - Paper chat (RAG)
- `POST /api/recommendations` - Resume recommendations
- `GET /api/papers/:id/pdf-url` - Get presigned PDF URL

### 13.3 Data Access Optimization
- Implement pagination for large datasets
- Add caching layer (Redis/ElastiCache)
- Use DynamoDB Query instead of Scan where possible
- Implement GraphQL for flexible queries

### 13.4 Monitoring and Observability
- Add error tracking (Sentry, CloudWatch)
- Implement usage analytics
- Monitor AWS service costs
- Add performance monitoring

---

## 14. Conclusion

Paper Pigeon is a feature-rich research network visualization tool with strong UI/UX and accessibility features. However, it has **critical security vulnerabilities** due to client-side AWS credential exposure. The application should be refactored to use a backend API layer before production deployment.

**Key Strengths**:
- Modern React architecture
- Rich 3D visualization
- Comprehensive accessibility features
- RAG-powered paper chat
- Resume-based recommendations

**Key Weaknesses**:
- No backend security layer
- Exposed AWS credentials
- Direct database access from browser
- No user authentication
- Scalability concerns with full table scans

---

**Document Version**: 1.0  
**Last Updated**: Based on codebase analysis  
**For**: External architectural planning and security review

