# Paper Pigeon - Complete Architecture Analysis

**Analysis Date**: Current  
**Purpose**: Deployment preparation for Vercel (static frontend + Python serverless backend)  
**Deployment Target**: Vercel Serverless Functions (Python Runtime)

---

## Table of Contents

1. [Directory Map](#directory-map)
2. [Backend Data Flow](#backend-data-flow)
3. [Frontend Data Flow](#frontend-data-flow)
4. [Environment Variables Inventory](#environment-variables-inventory)
5. [AWS Data Sources](#aws-data-sources)
6. [Safe Default Fallback Behavior](#safe-default-fallback-behavior)
7. [Deployment Blockers](#deployment-blockers)
8. [Essential vs. Optional Code](#essential-vs-optional-code)

---

## Directory Map

```
paper-pigeon/
├── backend/                          # Flask Python backend
│   ├── __init__.py                   # Loads .env via dotenv (production only)
│   ├── app.py                        # Flask app entry point, cache-first API
│   ├── graph_core.py                 # Pure Python graph builder (DynamoDB → JSON)
│   ├── build_graph_cache.py          # Script to rebuild cache from DynamoDB
│   ├── cache/
│   │   └── graph_cache.json          # Local graph cache (loaded on startup)
│   ├── controllers/                 # Flask blueprints
│   │   ├── pdf_controller.py        # S3 presigned URL generation
│   │   ├── rag_controller.py        # Bedrock RAG chat endpoint
│   │   └── recommendations_controller.py  # Resume-based recommendations
│   ├── services/                     # AWS service wrappers (black-box)
│   │   ├── dynamodb_service.py       # DynamoDB queries (researchers, papers, edges)
│   │   ├── s3_service.py            # S3 presigned URL generation
│   │   └── bedrock_service.py       # Bedrock RetrieveAndGenerate calls
│   └── utils/
│       ├── cors.py                   # CORS configuration (localhost:5173)
│       └── auth.py                   # Empty (no auth currently)
│
├── src/                              # React + TypeScript frontend
│   ├── main.tsx                      # React entry point
│   ├── App.tsx                       # Root component (AccessibilityProvider wrapper)
│   ├── components/
│   │   ├── ResearchNetworkGraph.tsx  # Main 3D graph visualization
│   │   ├── SearchBar.tsx             # Search + resume upload
│   │   ├── ResearcherProfilePanel.tsx  # Hover panel
│   │   ├── ResearcherModal.tsx      # Full researcher modal
│   │   ├── PaperChatModal.tsx       # RAG chat interface
│   │   ├── RecommendationsModal.tsx  # Resume recommendations
│   │   ├── LabModal.tsx             # Lab information modal
│   │   ├── AccessibilityPanel.tsx   # Accessibility settings
│   │   └── ui/                       # shadcn/ui components
│   ├── services/
│   │   ├── dynamodb.ts              # Frontend API calls (fetchGraphData, etc.)
│   │   └── pdf.ts                   # Client-side PDF parsing (pdfjs-dist)
│   ├── contexts/
│   │   └── AccessibilityContext.tsx # Accessibility state management
│   └── lib/
│       └── utils.ts                  # Utility functions (cn helper)
│
├── public/
│   └── graph_cache.json              # Static graph cache (for deployment)
│
├── package.json                      # Frontend dependencies
├── vite.config.ts                    # Vite configuration
├── tsconfig.json                     # TypeScript configuration
└── components.json                   # shadcn/ui configuration
```

---

## Backend Data Flow

### Application Startup (`backend/app.py`)

1. **Environment Loading** (`backend/__init__.py`):
   - Loads `.env` file from `backend/.env` (if exists)
   - Uses `dotenv.load_dotenv()` - **only for production**
   - **No environment setup required for local testing** (boto3 uses default credentials)

2. **Graph Cache Loading** (`load_graph_cache()`):
   - Reads `backend/cache/graph_cache.json` on startup
   - Loads into in-memory `_graph_cache` variable
   - Falls back to empty `{"nodes": [], "links": []}` if file missing
   - Prints warning if cache not found

3. **Flask App Initialization**:
   - CORS enabled for `http://localhost:5173` only
   - Registers blueprints:
     - `/api/rag/*` → `rag_controller.py`
     - `/api/recommendations/*` → `recommendations_controller.py`
     - `/api/pdf/*` → `pdf_controller.py`

### API Endpoints

#### 1. `/api/graph/data` (GET)
- **Purpose**: Serve cached graph data instantly
- **Data Source**: In-memory `_graph_cache` (loaded from `backend/cache/graph_cache.json`)
- **AWS Calls**: **NONE** (cache-first design)
- **Response**: `{"nodes": [...], "links": [...]}`
- **Fallback**: Returns empty graph if cache not loaded

#### 2. `/api/graph/rebuild-cache` (POST)
- **Purpose**: Manually rebuild cache from DynamoDB
- **Data Source**: DynamoDB (via `graph_core.build_graph_data_pure()`)
- **AWS Calls**: 
  - `dynamodb_service.fetch_researchers()`
  - `dynamodb_service.fetch_paper_edges()`
  - `dynamodb_service.fetch_advisor_edges()`
  - `dynamodb_service.fetch_library_entries(researcher_id)` (per researcher)
  - `dynamodb_service.fetch_papers(document_ids)` (batch)
  - `dynamodb_service.fetch_descriptions(researcher_ids)` (batch)
  - `dynamodb_service.fetch_metrics(researcher_ids)` (batch)
- **Process**:
  1. Calls `build_graph_data_pure()` → queries all DynamoDB tables
  2. Updates in-memory `_graph_cache`
  3. Saves to `backend/cache/graph_cache.json`
- **Response**: `{"success": true, "nodes": N, "links": M}`

#### 3. `/api/graph/paper-lab-id` (POST)
- **Purpose**: Get `lab_id` for a paper document
- **Data Source**: DynamoDB `papers` table
- **AWS Calls**: `dynamodb_service.fetch_papers([document_id])`
- **Request**: `{"document_id": "..."}`
- **Response**: `{"lab_id": "..."}` or `{"lab_id": null}`

#### 4. `/api/rag/chat` (POST)
- **Purpose**: RAG chat about a specific paper
- **Data Source**: AWS Bedrock Knowledge Base
- **AWS Calls**: `bedrock_service.rag_chat(query, document_id)`
  - Uses `bedrock-agent-runtime.retrieve_and_generate()`
  - Knowledge Base: `VITE_BEDROCK_KNOWLEDGE_BASE_ID`
  - Data Source: `VITE_BEDROCK_DATA_SOURCE_ID`
  - Filter: `document_id` equals provided value
- **Request**: `{"query": "...", "document_id": "..."}`
- **Response**: `{"answer": "...", "citations": [...]}`

#### 5. `/api/recommendations/from-resume` (POST)
- **Purpose**: Recommend researchers based on resume text
- **Data Source**: AWS Bedrock Knowledge Base (secondary)
- **AWS Calls**: `bedrock_service.rag_recommend(resume_text)`
  - Uses `bedrock-agent-runtime.retrieve_and_generate()`
  - Knowledge Base: `VITE_BEDROCK_KNOWLEDGE_BASE_ID_2`
  - Model: `meta.llama3-1-70b-instruct-v1:0` (hardcoded)
  - Returns JSON with recommendations array
- **Request**: `{"resume_text": "..."}`
- **Response**: `{"recommendations": [{"name": "...", "score": 0.9, "rationale": "..."}]}`

#### 6. `/api/pdf/url` (POST)
- **Purpose**: Generate presigned S3 URL for PDF document
- **Data Source**: AWS S3
- **AWS Calls**: `s3_service.get_presigned_pdf_url(lab_id, document_id)`
  - Uses `boto3.client("s3").generate_presigned_url()`
  - Bucket: `S3_BUCKET_NAME` env var
  - Key: `{lab_id}/{document_id}.pdf`
  - Expires: 3600 seconds (1 hour)
- **Request**: `{"lab_id": "...", "document_id": "..."}`
- **Response**: `{"url": "https://s3.amazonaws.com/..."}`

### Graph Building Process (`backend/graph_core.py`)

**Function**: `build_graph_data_pure()`

**Steps**:
1. Fetch all researchers from `researchers` table
2. Fetch all paper edges from `paper-edges` table
3. Fetch all advisor edges from `advisor_edges` table
4. Batch fetch descriptions from `descriptions` table
5. Batch fetch metrics from `metrics` table
6. For each researcher:
   - Fetch library entries (researcher → papers mapping)
   - Batch fetch papers for those document IDs
   - Extract tags from papers
   - Build researcher node with all metadata
7. Build lab nodes (static list of 24 labs)
8. Build links:
   - Paper edges (researcher ↔ researcher)
   - Advisor edges (advisee → advisor)
   - Researcher-lab edges (researcher → lab)
9. Return `{"nodes": [...], "links": [...]}`

**DynamoDB Tables Used**:
- `researchers` (scan)
- `papers` (batch get)
- `paper-edges` (scan)
- `advisor_edges` (scan)
- `library` (scan with filter)
- `descriptions` (batch get)
- `metrics` (batch get)
- `lab-info` (batch get, used by frontend only)

---

## Frontend Data Flow

### Application Initialization (`src/main.tsx` → `src/App.tsx`)

1. **React Bootstrap**:
   - `main.tsx` renders `App` component
   - `App.tsx` wraps `ResearchNetworkGraph` with `AccessibilityProvider`

2. **Graph Data Loading** (`ResearchNetworkGraph.tsx`):
   - On mount, calls `fetchGraphData()` from `services/dynamodb.ts`
   - Fetches from `${VITE_API_URL}/api/graph/data`
   - Sets `graphData` state (or shows error if fetch fails)
   - **No direct AWS calls** - all via backend API

### Component Data Flow

#### 1. Graph Visualization (`ResearchNetworkGraph.tsx`)
- **Initial Load**: `fetchGraphData()` → `/api/graph/data` → displays 3D graph
- **Node Hover**: Shows `ResearcherProfilePanel` with researcher info (from graph data)
- **Node Click**: Opens `ResearcherModal` or `LabModal`
- **Search Highlighting**: Filters nodes client-side, highlights matching nodes

#### 2. Search & Recommendations (`SearchBar.tsx`)
- **Search**: Client-side filtering on `graphData.nodes` (name, labs, tags)
- **Resume Upload**: 
  1. Client-side PDF parsing (`pdf.ts` using `pdfjs-dist`)
  2. Extracts text from PDF
  3. Calls `/api/recommendations/from-resume` with resume text
  4. Opens `RecommendationsModal` with results
  5. **Fallback**: If API fails, uses local similarity matching (Jaccard-like on tags/about)

#### 3. Researcher Profile (`ResearcherModal.tsx`, `ResearcherProfilePanel.tsx`)
- **Data Source**: All from `graphData` (loaded on mount)
- **PDF Access**: 
  - User clicks paper → calls `/api/pdf/url` with `lab_id` and `document_id`
  - Gets presigned S3 URL → opens in new tab
- **Paper Chat**: Opens `PaperChatModal` with selected paper

#### 4. Paper Chat (`PaperChatModal.tsx`)
- **User Input**: Question about paper
- **API Call**: `/api/rag/chat` with `query` and `document_id`
- **Response**: Displays answer + citations from Bedrock

#### 5. Lab Modal (`LabModal.tsx`)
- **Data Source**: 
  - Lab info from `graphData.nodes` (lab nodes)
  - Additional info: Calls `DynamoDBService.fetchLabInfos([labId])` (frontend service, but should use backend)
  - **Note**: Currently uses frontend DynamoDB service (needs migration to backend API)

### Frontend API Calls Summary

All frontend API calls use `import.meta.env.VITE_API_URL`:

1. **Graph Data**: `GET ${VITE_API_URL}/api/graph/data`
2. **Paper Lab ID**: `POST ${VITE_API_URL}/api/graph/paper-lab-id`
3. **RAG Chat**: `POST ${VITE_API_URL}/api/rag/chat`
4. **Recommendations**: `POST ${VITE_API_URL}/api/recommendations/from-resume`
5. **PDF URL**: `POST ${VITE_API_URL}/api/pdf/url`

**No direct AWS SDK calls in frontend** (all via backend API).

---

## Environment Variables Inventory

### Backend Environment Variables (Python `os.getenv()`)

#### Required for AWS Services:
- `AWS_REGION` - AWS region (e.g., `us-west-2`)
  - Used by: `dynamodb_service.py`, `s3_service.py`, `bedrock_service.py`
  - **Fallback**: None (will fail if missing)

- `AWS_ACCESS_KEY_ID` - AWS access key
  - Used by: `bedrock_service.py` (explicit credentials)
  - **Note**: `dynamodb_service.py` and `s3_service.py` use boto3 default credentials (no explicit key)
  - **Fallback**: boto3 will use default credential chain (IAM role, ~/.aws/credentials, etc.)

- `AWS_SECRET_ACCESS_KEY` - AWS secret key
  - Used by: `bedrock_service.py` (explicit credentials)
  - **Fallback**: boto3 will use default credential chain

- `S3_BUCKET_NAME` - S3 bucket for PDFs
  - Used by: `s3_service.py` (presigned URL generation)
  - **Fallback**: None (will fail if missing)

- `VITE_BEDROCK_KNOWLEDGE_BASE_ID` - Primary Bedrock KB for paper chat
  - Used by: `bedrock_service.py` (`rag_chat()`)
  - **Fallback**: None (will fail if missing)

- `VITE_BEDROCK_DATA_SOURCE_ID` - Primary Bedrock data source
  - Used by: `bedrock_service.py` (`rag_chat()`)
  - **Fallback**: None (will fail if missing)

- `VITE_BEDROCK_KNOWLEDGE_BASE_ID_2` - Secondary Bedrock KB for recommendations
  - Used by: `bedrock_service.py` (`rag_recommend()`)
  - **Fallback**: None (will fail if missing)

#### Optional:
- `VITE_BEDROCK_DATA_SOURCE_ID_2` - Secondary Bedrock data source (not currently used)
- `VITE_BEDROCK_MODEL_ID` - Bedrock model (hardcoded to `meta.llama3-1-70b-instruct-v1:0`)

### Frontend Environment Variables (`import.meta.env`)

#### Required:
- `VITE_API_URL` - Backend API base URL
  - Used by: All API calls in `services/dynamodb.ts`, `PaperChatModal.tsx`, `ResearcherModal.tsx`, `ResearcherProfilePanel.tsx`, `ResearchNetworkGraph.tsx`
  - **Examples**: 
    - Dev: `http://localhost:5000`
    - Prod: `https://api.vercel.app` (or custom domain)
  - **Fallback**: None (will fail if missing - fetch will error)

### Environment Variable Loading

**Backend** (`backend/__init__.py`):
- Loads `.env` from `backend/.env` using `dotenv.load_dotenv()`
- **Only loads if file exists** (no error if missing)
- **For production**: Should use Vercel environment variables (not `.env` file)

**Frontend** (`vite.config.ts`):
- Vite automatically exposes `VITE_*` variables via `import.meta.env`
- Variables must be prefixed with `VITE_` to be accessible
- **Build-time**: Variables are embedded in bundle
- **Runtime**: Cannot change after build (must rebuild)

---

## AWS Data Sources

### DynamoDB Tables

1. **`researchers`**
   - **Usage**: Fetched in `graph_core.py` → `build_graph_data_pure()`
   - **Fields**: `researcher_id`, `name`, `advisor`, `contact_info[]`, `labs[]`, `standing`, `tags[]`, `influence`, `about`
   - **Access Pattern**: Full table scan (cached in memory)

2. **`papers`**
   - **Usage**: Batch fetched by `document_id` in `graph_core.py`
   - **Fields**: `document_id`, `title`, `year`, `tags[]`, `lab_id`
   - **Access Pattern**: Batch get (100 items max per call)

3. **`paper-edges`**
   - **Usage**: Fetched in `graph_core.py` → builds paper collaboration links
   - **Fields**: `researcher_one_id`, `researcher_two_id`
   - **Access Pattern**: Full table scan

4. **`advisor_edges`**
   - **Usage**: Fetched in `graph_core.py` → builds advisor relationships
   - **Fields**: `advisee_id`, `advisor_id`
   - **Access Pattern**: Full table scan

5. **`library`**
   - **Usage**: Fetched per researcher in `graph_core.py` → maps researchers to papers
   - **Fields**: `researcher_id`, `document_id`
   - **Access Pattern**: Scan with filter (per researcher)

6. **`descriptions`**
   - **Usage**: Batch fetched in `graph_core.py` → adds `about` field to researcher nodes
   - **Fields**: `researcher_id`, `about`
   - **Access Pattern**: Batch get

7. **`metrics`**
   - **Usage**: Batch fetched in `graph_core.py` → adds `influence` score to researcher nodes
   - **Fields**: `researcher_id`, `influence`
   - **Access Pattern**: Batch get

8. **`lab-info`**
   - **Usage**: Fetched by frontend (via `DynamoDBService.fetchLabInfos()` - **needs backend migration**)
   - **Fields**: `lab_id`, `description`, `faculty[]`
   - **Access Pattern**: Batch get

### AWS S3

- **Bucket**: `S3_BUCKET_NAME` environment variable
- **Structure**: `{lab_id}/{document_id}.pdf`
- **Usage**: Generate presigned URLs for PDF viewing (1-hour expiration)
- **Access**: Via `s3_service.get_presigned_pdf_url()`

### AWS Bedrock

1. **Primary Knowledge Base** (`VITE_BEDROCK_KNOWLEDGE_BASE_ID`):
   - **Usage**: Paper chat RAG (`rag_chat()`)
   - **Data Source**: `VITE_BEDROCK_DATA_SOURCE_ID`
   - **Filter**: By `document_id` (paper-specific queries)

2. **Secondary Knowledge Base** (`VITE_BEDROCK_KNOWLEDGE_BASE_ID_2`):
   - **Usage**: Resume-based recommendations (`rag_recommend()`)
   - **Model**: `meta.llama3-1-70b-instruct-v1:0` (hardcoded)
   - **Retrieval**: Hybrid search, 25 results

---

## Safe Default Fallback Behavior

### Current Behavior (No Fallbacks)

**Backend**:
- Graph cache: Returns empty `{"nodes": [], "links": []}` if cache file missing
- DynamoDB calls: Will raise exceptions if credentials missing
- Bedrock calls: Will raise exceptions if credentials/KB IDs missing
- S3 calls: Will raise exceptions if bucket name missing

**Frontend**:
- API calls: Will fail with network errors if `VITE_API_URL` missing
- Graph data: Shows error message if fetch fails

### Recommended Safe Defaults for Deployment

#### 1. Graph Data Endpoint (`/api/graph/data`)

**Current**: Returns empty graph if cache missing  
**Recommended**: 
- Try to load `backend/cache/graph_cache.json`
- If missing, try to load `public/graph_cache.json` (static file)
- If both missing, return empty graph with warning log
- **No DynamoDB fallback** (too slow for production)

#### 2. RAG Chat Endpoint (`/api/rag/chat`)

**Current**: Raises exception if Bedrock credentials missing  
**Recommended**:
- Check if `VITE_BEDROCK_KNOWLEDGE_BASE_ID` is set
- If missing, return: `{"answer": "RAG service is not configured. Please contact the administrator.", "citations": []}`
- Log warning (don't crash)

#### 3. Recommendations Endpoint (`/api/recommendations/from-resume`)

**Current**: Raises exception if Bedrock credentials missing  
**Recommended**:
- Check if `VITE_BEDROCK_KNOWLEDGE_BASE_ID_2` is set
- If missing, return: `{"recommendations": []}` (frontend will use local similarity fallback)
- Log warning (don't crash)

#### 4. PDF URL Endpoint (`/api/pdf/url`)

**Current**: Raises exception if S3 bucket missing  
**Recommended**:
- Check if `S3_BUCKET_NAME` is set
- If missing, return: `{"error": "PDF service is not configured"}` with 503 status
- Log warning (don't crash)

#### 5. Paper Lab ID Endpoint (`/api/graph/paper-lab-id`)

**Current**: Raises exception if DynamoDB credentials missing  
**Recommended**:
- Check if `AWS_REGION` is set
- If missing, return: `{"lab_id": null}` (graceful degradation)
- Log warning (don't crash)

#### 6. Rebuild Cache Endpoint (`/api/graph/rebuild-cache`)

**Current**: Raises exception if DynamoDB credentials missing  
**Recommended**:
- Check if `AWS_REGION` is set
- If missing, return: `{"success": false, "error": "DynamoDB not configured"}` with 503 status
- Log warning (don't crash)

#### 7. Frontend API URL (`VITE_API_URL`)

**Current**: Fetch fails if missing  
**Recommended**:
- Build-time check: Warn if `VITE_API_URL` is undefined
- Runtime: Try relative URL fallback (`/api/...`) if `VITE_API_URL` is empty
- **Note**: Vite requires `VITE_*` prefix, so this must be set at build time

---

## Deployment Blockers

### Critical Blockers (Must Fix)

1. **CORS Configuration** (`backend/app.py:26`)
   - **Issue**: Hardcoded to `http://localhost:5173` only
   - **Impact**: Production requests will be blocked
   - **Fix**: Use environment variable or allow all origins in production
   - **Location**: `backend/app.py`, `backend/utils/cors.py`

2. **Frontend API URL** (`src/services/dynamodb.ts`, etc.)
   - **Issue**: `VITE_API_URL` must be set at build time
   - **Impact**: Frontend cannot connect to backend if missing
   - **Fix**: Set `VITE_API_URL` in Vercel environment variables before build
   - **Location**: All frontend API calls

3. **Backend Environment Variables**
   - **Issue**: Backend expects `.env` file (not suitable for Vercel)
   - **Impact**: AWS services won't work without credentials
   - **Fix**: Use Vercel environment variables (accessed via `os.getenv()`)
   - **Location**: `backend/__init__.py` (remove `.env` file requirement for production)

4. **Graph Cache Location**
   - **Issue**: Backend loads from `backend/cache/graph_cache.json` (not accessible in serverless)
   - **Impact**: Graph data won't load if cache file not in deployment
   - **Fix**: 
     - Option A: Load from `public/graph_cache.json` (static file, served by Vercel)
     - Option B: Load from environment variable (base64 encoded JSON)
     - Option C: Load from external URL (CDN)
   - **Location**: `backend/app.py:load_graph_cache()`

5. **Static Graph Cache** (`public/graph_cache.json`)
   - **Issue**: File exists but backend doesn't read it
   - **Impact**: Backend won't serve graph data if `backend/cache/` not available
   - **Fix**: Modify `load_graph_cache()` to check `public/graph_cache.json` as fallback
   - **Location**: `backend/app.py:load_graph_cache()`

### Medium Priority Blockers

6. **Lab Info Endpoint Missing**
   - **Issue**: Frontend calls `DynamoDBService.fetchLabInfos()` directly (frontend service)
   - **Impact**: Lab modal won't show full info in production (if frontend DynamoDB removed)
   - **Fix**: Add `/api/labs/info` endpoint in backend
   - **Location**: `src/components/ResearchNetworkGraph.tsx:64`, `backend/app.py` (new endpoint)

7. **Error Handling**
   - **Issue**: No graceful fallbacks for missing AWS credentials
   - **Impact**: App crashes instead of degrading gracefully
   - **Fix**: Add try-catch blocks and return safe defaults (see Safe Defaults section)
   - **Location**: All service files, all controllers

8. **Debug Print Statements**
   - **Issue**: `backend/services/dynamodb_service.py:6` prints AWS credentials (security risk)
   - **Impact**: Credentials may leak in logs
   - **Fix**: Remove or mask credential logging
   - **Location**: `backend/services/dynamodb_service.py:6,19`

### Low Priority (Nice to Have)

9. **Hardcoded CORS Origins**
   - **Issue**: Only allows `localhost:5173`
   - **Impact**: Development only (production needs different origin)
   - **Fix**: Use environment variable for allowed origins
   - **Location**: `backend/app.py:26`

10. **Empty Auth Module**
   - **Issue**: `backend/utils/auth.py` is empty
   - **Impact**: No authentication (may be intentional)
   - **Fix**: Add auth if needed, or remove file
   - **Location**: `backend/utils/auth.py`

11. **Build Script Dependencies**
   - **Issue**: `backend/build_graph_cache.py` requires `.env` file
   - **Impact**: Cannot rebuild cache in CI/CD without `.env`
   - **Fix**: Use environment variables (not file-based)
   - **Location**: `backend/build_graph_cache.py:25-31`

---

## Essential vs. Optional Code

### Essential for Deployment (Core Functionality)

**Backend**:
- ✅ `backend/app.py` - Flask app, all endpoints
- ✅ `backend/controllers/*.py` - All three controllers (PDF, RAG, recommendations)
- ✅ `backend/services/*.py` - All three services (DynamoDB, S3, Bedrock)
- ✅ `backend/graph_core.py` - Graph building logic (for rebuild endpoint)
- ✅ `backend/__init__.py` - Environment loading (modify for Vercel)
- ✅ `backend/cache/graph_cache.json` OR `public/graph_cache.json` - Static graph data

**Frontend**:
- ✅ `src/App.tsx`, `src/main.tsx` - Entry points
- ✅ `src/components/ResearchNetworkGraph.tsx` - Main graph component
- ✅ `src/components/SearchBar.tsx` - Search functionality
- ✅ `src/components/*Modal.tsx` - All modals (researcher, paper chat, recommendations, lab)
- ✅ `src/components/ResearcherProfilePanel.tsx` - Hover panel
- ✅ `src/services/dynamodb.ts` - API client (no direct AWS calls)
- ✅ `src/services/pdf.ts` - PDF parsing
- ✅ `src/contexts/AccessibilityContext.tsx` - Accessibility features
- ✅ `public/graph_cache.json` - Static graph data (for initial load)

### Optional (Can Remove or Defer)

**Backend**:
- ⚠️ `backend/build_graph_cache.py` - Cache rebuild script (not needed in deployment, only for local dev)
- ⚠️ `backend/debug_*.py` - Debug scripts (remove for production)
- ⚠️ `backend/precompute_graph.py` - Precomputation script (not needed if using static cache)
- ⚠️ `backend/tools/` - Utility scripts (not needed in deployment)
- ⚠️ `backend/utils/auth.py` - Empty file (remove if not used)
- ⚠️ `backend/utils/cors.py` - Unused (CORS configured directly in `app.py`)

**Frontend**:
- ✅ All components are essential (no optional frontend code)

### Cleanup Needed (Post-Deployment)

1. **Remove Debug Scripts**:
   - `backend/debug_profile_graph.py`
   - `backend/debug_test_env.py`

2. **Remove Unused Utilities**:
   - `backend/utils/cors.py` (if not used)
   - `backend/utils/auth.py` (if empty and not needed)

3. **Consolidate Graph Cache**:
   - Decide on single source: `backend/cache/graph_cache.json` OR `public/graph_cache.json`
   - Remove duplicate if both exist

4. **Remove Build Tools from Deployment**:
   - `backend/tools/` directory (keep in repo, but exclude from Vercel deployment)
   - `backend/build_graph_cache.py` (keep for local dev, exclude from deployment)

---

## Summary

### Architecture Type
- **Backend**: Flask Python (development) → Vercel Serverless Functions (production)
- **Frontend**: Vite + React (static build) → Vercel static hosting
- **Data Flow**: Frontend → Backend API → AWS Services (DynamoDB, S3, Bedrock)
- **Caching**: Static `graph_cache.json` file (served instantly, no DynamoDB on read)

### Key Dependencies
- **AWS Services**: DynamoDB (8 tables), S3 (PDF storage), Bedrock (2 knowledge bases)
- **Environment Variables**: 8 backend vars, 1 frontend var
- **Static Assets**: `public/graph_cache.json` (initial data source)

### Deployment Strategy
1. **Frontend**: Build static files, deploy to Vercel static hosting
2. **Backend**: Deploy Flask app as Vercel Serverless Functions (Python runtime)
3. **Graph Data**: Use `public/graph_cache.json` as initial static source
4. **AWS Credentials**: Set via Vercel environment variables (not `.env` file)
5. **Fallbacks**: Add graceful degradation for missing AWS credentials

### Next Steps
1. Fix CORS configuration (environment-based origins)
2. Modify `load_graph_cache()` to read from `public/graph_cache.json`
3. Add safe fallbacks for all AWS service calls
4. Remove debug print statements (security)
5. Set `VITE_API_URL` in Vercel before build
6. Configure Vercel environment variables for all AWS credentials

---

**End of Analysis**

