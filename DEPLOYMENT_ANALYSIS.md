# Paper Pigeon - Deployment Analysis

**Purpose**: Pure analysis for Vercel deployment preparation  
**Rules**: Analysis only - no code modifications, no suggestions, no AWS infrastructure proposals

---

## 1. Repository Structure Map

```
paper-pigeon/
├── backend/                          # Flask Python backend
│   ├── __init__.py                   # Loads .env via dotenv (if file exists)
│   ├── app.py                        # Flask app entry point
│   ├── graph_core.py                 # Graph builder (DynamoDB → JSON)
│   ├── build_graph_cache.py          # Script to rebuild cache
│   ├── cache/
│   │   └── graph_cache.json          # Backend cache file (loaded on startup)
│   ├── controllers/                  # Flask blueprints
│   │   ├── pdf_controller.py          # /api/pdf/*
│   │   ├── rag_controller.py         # /api/rag/*
│   │   └── recommendations_controller.py  # /api/recommendations/*
│   ├── services/                     # AWS service wrappers (black-box)
│   │   ├── dynamodb_service.py       # DynamoDB queries
│   │   ├── s3_service.py             # S3 presigned URLs
│   │   └── bedrock_service.py        # Bedrock RAG
│   └── utils/
│       ├── cors.py                   # CORS utility (unused)
│       └── auth.py                   # Empty file
│
├── src/                              # React + TypeScript frontend
│   ├── main.tsx                      # React entry point
│   ├── App.tsx                       # Root component
│   ├── components/
│   │   ├── ResearchNetworkGraph.tsx  # Main 3D graph
│   │   ├── SearchBar.tsx             # Search + resume upload
│   │   ├── ResearcherProfilePanel.tsx
│   │   ├── ResearcherModal.tsx
│   │   ├── PaperChatModal.tsx
│   │   ├── RecommendationsModal.tsx
│   │   ├── LabModal.tsx
│   │   ├── AccessibilityPanel.tsx
│   │   └── ui/                       # shadcn/ui components
│   ├── services/
│   │   ├── dynamodb.ts              # API client (fetchGraphData, etc.)
│   │   └── pdf.ts                   # Client-side PDF parsing
│   ├── contexts/
│   │   └── AccessibilityContext.tsx
│   └── lib/
│       └── utils.ts
│
├── public/
│   └── graph_cache.json              # Static graph cache (exists in repo)
│
├── package.json                      # Frontend dependencies
├── vite.config.ts                    # Vite config
└── tsconfig.json                     # TypeScript config
```

---

## 2. Backend Data Flow

### Application Startup Sequence

1. **`backend/__init__.py`** (imported by `app.py`):
   - Attempts to load `.env` from `backend/.env` using `dotenv.load_dotenv()`
   - Only loads if file exists (no error if missing)
   - **Current behavior**: Silent if `.env` missing

2. **`backend/app.py`** startup:
   - Calls `load_graph_cache()` on import
   - `load_graph_cache()` reads `backend/cache/graph_cache.json`
   - Loads into in-memory `_graph_cache` variable
   - Falls back to `{"nodes": [], "links": []}` if file missing
   - **Does NOT read `public/graph_cache.json`**

3. **Flask app initialization**:
   - CORS configured: `origins=['http://localhost:5173']` (hardcoded)
   - Registers 3 blueprints:
     - `/api/rag/*` → `rag_controller.py`
     - `/api/recommendations/*` → `recommendations_controller.py`
     - `/api/pdf/*` → `pdf_controller.py`

### API Endpoints Behavior

#### `/api/graph/data` (GET)
- **Returns**: In-memory `_graph_cache` (loaded from `backend/cache/graph_cache.json`)
- **AWS Calls**: None
- **Current behavior**: Returns empty graph if cache file not found

#### `/api/graph/rebuild-cache` (POST)
- **Calls**: `graph_core.build_graph_data_pure()`
- **AWS Calls**: Multiple DynamoDB queries (researchers, papers, edges, library, descriptions, metrics)
- **Writes**: Updates `_graph_cache` and saves to `backend/cache/graph_cache.json`
- **Current behavior**: Raises exception if DynamoDB credentials missing

#### `/api/graph/paper-lab-id` (POST)
- **Calls**: `dynamodb_service.fetch_papers([document_id])`
- **AWS Calls**: DynamoDB batch get
- **Current behavior**: Raises exception if DynamoDB credentials missing

#### `/api/rag/chat` (POST)
- **Calls**: `bedrock_service.rag_chat(query, document_id)`
- **AWS Calls**: Bedrock `retrieve_and_generate()` with KB filter
- **Env vars used**: `VITE_BEDROCK_KNOWLEDGE_BASE_ID`, `VITE_BEDROCK_DATA_SOURCE_ID`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- **Current behavior**: Raises exception if credentials/KB IDs missing

#### `/api/recommendations/from-resume` (POST)
- **Calls**: `bedrock_service.rag_recommend(resume_text)`
- **AWS Calls**: Bedrock `retrieve_and_generate()` with secondary KB
- **Env vars used**: `VITE_BEDROCK_KNOWLEDGE_BASE_ID_2`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- **Current behavior**: Raises exception if credentials/KB ID missing

#### `/api/pdf/url` (POST)
- **Calls**: `s3_service.get_presigned_pdf_url(lab_id, document_id)`
- **AWS Calls**: S3 `generate_presigned_url()`
- **Env vars used**: `S3_BUCKET_NAME`, `AWS_REGION`
- **Current behavior**: Raises exception if bucket name/region missing

### Graph Building Process (`graph_core.py`)

**Function**: `build_graph_data_pure()`

**DynamoDB Tables Queried**:
1. `researchers` (scan)
2. `papers` (batch get)
3. `paper-edges` (scan)
4. `advisor_edges` (scan)
5. `library` (scan with filter, per researcher)
6. `descriptions` (batch get)
7. `metrics` (batch get)

**Output**: `{"nodes": [...], "links": [...]}`

---

## 3. Frontend Data Flow

### Application Initialization

1. **`src/main.tsx`** → renders `App` component
2. **`src/App.tsx`** → wraps `ResearchNetworkGraph` with `AccessibilityProvider`
3. **`ResearchNetworkGraph.tsx`** (on mount):
   - Calls `fetchGraphData()` from `services/dynamodb.ts`
   - Fetches: `GET ${VITE_API_URL}/api/graph/data`
   - Sets `graphData` state
   - Shows error message if fetch fails

### Component Data Flows

#### Graph Visualization
- **Data source**: `graphData` state (from `/api/graph/data`)
- **All node/link data**: From `graphData` (no additional API calls)
- **Node hover**: Displays data from `graphData.nodes`
- **Node click**: Opens modal with data from `graphData.nodes`

#### Search & Recommendations
- **Search**: Client-side filtering on `graphData.nodes`
- **Resume upload**:
  1. Client-side PDF parsing (`pdf.ts`)
  2. POST to `/api/recommendations/from-resume`
  3. **Fallback**: If API fails, uses local similarity matching (Jaccard-like)

#### Researcher Profile
- **Data source**: `graphData.nodes` (researcher node)
- **PDF access**: POST to `/api/pdf/url` → opens presigned URL
- **Paper chat**: Opens `PaperChatModal` → POST to `/api/rag/chat`

#### Paper Chat
- **User input**: Question text
- **API call**: POST `/api/rag/chat` with `query` and `document_id`
- **Response**: Displays answer + citations

#### Lab Modal
- **Lab data**: From `graphData.nodes` (lab nodes)
- **Additional info**: Currently calls `DynamoDBService.fetchLabInfos()` (frontend service)
- **Note**: Frontend has DynamoDB service code, but should use backend API

### Frontend API Calls

All use `import.meta.env.VITE_API_URL`:

1. `GET ${VITE_API_URL}/api/graph/data` - Graph data
2. `POST ${VITE_API_URL}/api/graph/paper-lab-id` - Paper lab lookup
3. `POST ${VITE_API_URL}/api/rag/chat` - RAG chat
4. `POST ${VITE_API_URL}/api/recommendations/from-resume` - Recommendations
5. `POST ${VITE_API_URL}/api/pdf/url` - PDF presigned URL

**No direct AWS SDK calls in frontend** (all via backend API).

---

## 4. Environment Variables Inventory

### Backend Environment Variables (Python `os.getenv()`)

**Required for AWS Services**:
- `AWS_REGION` - Used by: `dynamodb_service.py`, `s3_service.py`, `bedrock_service.py`
- `AWS_ACCESS_KEY_ID` - Used by: `bedrock_service.py` (explicit)
- `AWS_SECRET_ACCESS_KEY` - Used by: `bedrock_service.py` (explicit)
- `S3_BUCKET_NAME` - Used by: `s3_service.py`
- `VITE_BEDROCK_KNOWLEDGE_BASE_ID` - Used by: `bedrock_service.py` (`rag_chat()`)
- `VITE_BEDROCK_DATA_SOURCE_ID` - Used by: `bedrock_service.py` (`rag_chat()`)
- `VITE_BEDROCK_KNOWLEDGE_BASE_ID_2` - Used by: `bedrock_service.py` (`rag_recommend()`)

**Note**: `dynamodb_service.py` and `s3_service.py` use boto3 default credential chain (no explicit keys).

### Frontend Environment Variables (`import.meta.env`)

**Required**:
- `VITE_API_URL` - Backend API base URL
  - Used by: All API calls in `services/dynamodb.ts`, `PaperChatModal.tsx`, `ResearcherModal.tsx`, `ResearcherProfilePanel.tsx`, `ResearchNetworkGraph.tsx`
  - **Build-time**: Embedded in bundle (must be set before build)

### Environment Variable Loading

**Backend** (`backend/__init__.py`):
- Loads `.env` from `backend/.env` if file exists
- Uses `dotenv.load_dotenv()` (no error if file missing)

**Frontend** (`vite.config.ts`):
- Vite exposes `VITE_*` variables via `import.meta.env`
- Variables embedded at build time (cannot change at runtime)

---

## 5. Vercel Deployment Requirements

### Backend (Vercel Serverless Functions - Python Runtime)

**Required Files**:
- `backend/app.py` - Flask app
- `backend/controllers/*.py` - All 3 controllers
- `backend/services/*.py` - All 3 services
- `backend/graph_core.py` - Graph builder (for rebuild endpoint)
- `backend/__init__.py` - Environment loader

**Required Environment Variables** (set in Vercel dashboard):
- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `S3_BUCKET_NAME`
- `VITE_BEDROCK_KNOWLEDGE_BASE_ID`
- `VITE_BEDROCK_DATA_SOURCE_ID`
- `VITE_BEDROCK_KNOWLEDGE_BASE_ID_2`

**Graph Cache**:
- Backend currently loads from `backend/cache/graph_cache.json`
- `public/graph_cache.json` exists but backend doesn't read it
- **Current state**: Backend will return empty graph if `backend/cache/graph_cache.json` not accessible

**CORS Configuration**:
- Currently hardcoded: `origins=['http://localhost:5173']`
- **Current state**: Will block production requests

### Frontend (Vercel Static Hosting)

**Required Files**:
- All files in `src/`
- `public/graph_cache.json` - Static graph data (exists)
- `package.json`, `vite.config.ts`, `tsconfig.json`

**Required Environment Variables** (set in Vercel before build):
- `VITE_API_URL` - Backend API URL

**Build Process**:
- `pnpm build` (or `npm run build`)
- Output: `dist/` directory (static files)

**Static Assets**:
- `public/graph_cache.json` - Will be served at `/graph_cache.json`
- Frontend does NOT currently use this file (fetches from backend API)

---

## 6. Deployment Blockers

### Critical Blockers

1. **CORS Configuration** (`backend/app.py:26`)
   - **Current**: Hardcoded `origins=['http://localhost:5173']`
   - **Impact**: Production frontend requests will be blocked
   - **Location**: `backend/app.py:26`

2. **Graph Cache Location Mismatch**
   - **Backend reads**: `backend/cache/graph_cache.json`
   - **Static file exists**: `public/graph_cache.json`
   - **Impact**: Backend won't serve graph data if `backend/cache/` not accessible in serverless
   - **Location**: `backend/app.py:load_graph_cache()`

3. **Frontend API URL** (`VITE_API_URL`)
   - **Current**: Must be set at build time
   - **Impact**: Frontend cannot connect to backend if missing
   - **Location**: All frontend API calls use `import.meta.env.VITE_API_URL`

4. **Backend Environment Variables**
   - **Current**: Backend loads from `.env` file (if exists)
   - **Impact**: AWS services won't work without Vercel environment variables
   - **Location**: `backend/__init__.py` (loads `.env`), all service files (use `os.getenv()`)

5. **No Error Handling for Missing Credentials**
   - **Current**: All AWS service calls raise exceptions if credentials missing
   - **Impact**: App crashes instead of degrading gracefully
   - **Location**: All service files, all controllers

### Medium Priority Blockers

6. **Lab Info Endpoint Missing**
   - **Current**: Frontend calls `DynamoDBService.fetchLabInfos()` (frontend service)
   - **Impact**: Lab modal won't show full info if frontend DynamoDB service removed
   - **Location**: `src/components/ResearchNetworkGraph.tsx:64`

7. **Debug Print Statements**
   - **Current**: `backend/services/dynamodb_service.py:6` prints AWS credentials
   - **Impact**: Security risk (credentials may leak in logs)
   - **Location**: `backend/services/dynamodb_service.py:6,19`

### Low Priority

8. **Empty/Unused Files**
   - `backend/utils/auth.py` - Empty file
   - `backend/utils/cors.py` - Unused (CORS configured in `app.py`)

9. **Build Scripts**
   - `backend/build_graph_cache.py` - Requires `.env` file
   - `backend/debug_*.py` - Debug scripts (not needed in deployment)

---

## 7. Current Behavior Summary

### Backend Behavior

- **Graph cache loading**: Reads `backend/cache/graph_cache.json` on startup
- **Environment loading**: Loads `.env` from `backend/.env` if exists (silent if missing)
- **CORS**: Only allows `http://localhost:5173`
- **Error handling**: Raises exceptions if AWS credentials missing
- **Graph endpoint**: Returns in-memory cache (empty if file not found)

### Frontend Behavior

- **Graph data**: Fetches from `${VITE_API_URL}/api/graph/data` on mount
- **Error handling**: Shows error message if fetch fails
- **API URL**: Must be set at build time (`VITE_API_URL`)
- **Static cache**: `public/graph_cache.json` exists but not used by frontend

### AWS Service Behavior

- **DynamoDB**: Uses boto3 default credential chain (no explicit keys required)
- **Bedrock**: Requires explicit `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
- **S3**: Uses boto3 default credential chain (no explicit keys required)
- **All services**: Require `AWS_REGION` environment variable

---

## 8. Static Graph Cache Status

**File Location**: `public/graph_cache.json`

**Current Usage**:
- ✅ File exists in repository
- ❌ Backend does NOT read this file
- ❌ Frontend does NOT read this file directly
- ✅ Frontend fetches graph data from backend API

**Backend Cache Location**: `backend/cache/graph_cache.json`

**Current Usage**:
- ✅ Backend reads this file on startup
- ✅ Loads into in-memory `_graph_cache`
- ❌ Not accessible in Vercel serverless (file system is read-only)

---

**End of Analysis**

