## Paper Pigeon - Architecture & Deployment Overview

**Purpose**: Document the current architecture of Paper Pigeon for deployment and maintenance.  
**Architecture**: React + Vite frontend, Flask backend on Vercel Python Serverless Functions.  
**Data Plane**: Precomputed research graph served from a static JSON cache; AWS is used for RAG, recommendations, and PDF access.

---

## 1. Directory Map

```text
paper-pigeon/
├── backend/                          # Flask Python backend
│   ├── app.py                        # Flask app, graph endpoints, health check
│   ├── graph_core.py                 # Graph builder (DynamoDB → JSON)
│   ├── cache/
│   │   └── graph_cache.json          # Optional local graph cache
│   ├── controllers/                  # Flask blueprints
│   │   ├── pdf_controller.py         # /api/pdf/url → S3 presigned URLs
│   │   ├── rag_controller.py         # /api/rag/chat → Bedrock RAG chat
│   │   └── recommendations_controller.py  # /api/recommendations/from-resume
│   └── services/                     # AWS service wrappers
│       ├── dynamodb_service.py       # DynamoDB queries & caching
│       ├── s3_service.py             # S3 presigned URL generation
│       └── bedrock_service.py        # Bedrock RetrieveAndGenerate calls
│
├── api/
│   └── index.py                      # Vercel Python serverless entry point
│
├── src/                              # React + TypeScript frontend
│   ├── main.tsx                      # React entry point
│   ├── App.tsx                       # Root component with BrowserRouter
│   ├── components/
│   │   ├── ResearchNetworkGraph.tsx  # Main 3D graph visualization
│   │   ├── VRGraph.tsx               # VR mode graph
│   │   ├── SearchBar.tsx             # Search & resume upload
│   │   ├── ResearcherProfilePanel.tsx# Hover profile panel
│   │   ├── ResearcherModal.tsx       # Researcher detail modal
│   │   ├── PaperChatModal.tsx        # RAG chat interface
│   │   ├── RecommendationsModal.tsx  # Resume-based recommendations
│   │   ├── LabModal.tsx              # Lab information modal
│   │   ├── AccessibilityPanel.tsx    # Accessibility settings
│   │   └── ui/                       # shadcn/ui primitives
│   ├── services/
│   │   ├── dynamodb.ts               # Frontend API client
│   │   └── pdf.ts                    # Client-side PDF parsing (pdfjs-dist)
│   ├── contexts/
│   │   └── AccessibilityContext.tsx  # Accessibility state management
│   └── lib/
│       └── utils.ts                  # Utility helpers
│
├── public/
│   └── graph_cache.json              # Static graph cache shipped with frontend
│
├── vercel.json                       # Vercel rewrites for /api → api/index.py
└── package.json / vite.config.ts / tsconfig*.json
```

---

## 2. Backend Architecture & Data Flow

### 2.1 Flask App (`backend/app.py`)

- **App setup**:
  - Creates a `Flask` app and enables CORS for all origins (`*`)
  - Registers three blueprints:
    - `/api/rag/*` → `rag_controller`
    - `/api/recommendations/*` → `recommendations_controller`
    - `/api/pdf/*` → `pdf_controller`
  - Exposes `/api/graph/*` endpoints and `/health` directly on the app

- **Graph cache state**:
  - Uses a module-level `_graph_cache` that is **lazily loaded** on first request to `/api/graph/data`

### 2.2 Graph Cache Loading

- **Function**: `load_graph_cache()`
- **Behavior**:
  - Tries multiple paths in order:
    1. `backend/cache/graph_cache.json`
    2. `public/graph_cache.json`
    3. `dist/graph_cache.json`
    4. `/var/task/public/graph_cache.json` (Vercel absolute)
    5. `/var/task/dist/graph_cache.json` (Vercel dist)
  - If all fail, sets `_graph_cache` to `{"nodes": [], "links": []}`
- **Runtime impact**:
  - Once loaded, the cache is kept in memory for all subsequent requests
  - No DynamoDB calls on reads; all graph fetching is cache-first

### 2.3 API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/graph/data` | GET | Serve precomputed graph JSON |
| `/api/graph/rebuild-cache` | POST | Disabled (returns 503) |
| `/api/graph/paper-lab-id` | POST | Resolve paper to lab_id |
| `/api/rag/chat` | POST | RAG chat about a paper |
| `/api/recommendations/from-resume` | POST | Resume recommendations |
| `/api/pdf/url` | POST | S3 presigned URL |
| `/health` | GET | Health check |

### 2.4 AWS Service Layer

- **DynamoDB** (`backend/services/dynamodb_service.py`):
  - Lazy `boto3.resource("dynamodb")` initialization
  - In-memory caches for researchers, papers, library entries
  - Used for graph building and paper-lab-id lookup

- **S3** (`backend/services/s3_service.py`):
  - Uses `S3_BUCKET_NAME` and `AWS_REGION`
  - Key pattern: `{lab_id}/{document_id}.pdf`
  - Presigned URLs valid for 1 hour

- **Bedrock** (`backend/services/bedrock_service.py`):
  - Lazy client creation with diagnostic logging
  - `rag_chat()`: Uses primary knowledge base with document filter
  - `rag_recommend()`: Uses secondary knowledge base for recommendations

---

## 3. Frontend Architecture & Data Flow

### 3.1 App Bootstrap

- `src/main.tsx` mounts `App` into the DOM
- `src/App.tsx`:
  - Wraps app in `AccessibilityProvider` and `BrowserRouter`
  - Loads graph data on mount via `fetchGraphData()`
  - Routes: `/` (main graph), `/vr` (VR mode)

### 3.2 Graph Visualization

- **ResearchNetworkGraph.tsx**:
  - Uses `3d-force-graph` with three.js
  - Distinguishes labs (boxes) and researchers (spheres)
  - Supports node hover, click, and highlighting

- **VRGraph.tsx**:
  - Uses `3d-force-graph-vr` with A-Frame
  - Available at `/vr` route

### 3.3 Frontend API Client (`src/services/dynamodb.ts`)

```typescript
// All API calls use relative URLs
fetchGraphData()       → GET /api/graph/data
fetchPaperLabId(id)    → POST /api/graph/paper-lab-id
```

---

## 4. Environment Variables

### Backend (Python `os.getenv`)

| Variable | Required | Used By |
|----------|----------|---------|
| `AWS_ACCESS_KEY_ID` | Yes | Bedrock |
| `AWS_SECRET_ACCESS_KEY` | Yes | Bedrock |
| `AWS_REGION` | Yes | All AWS services |
| `S3_BUCKET_NAME` | Yes | S3 presigned URLs |
| `BEDROCK_KNOWLEDGE_BASE_ID` | Yes | Paper chat |
| `BEDROCK_KNOWLEDGE_BASE_ID_2` | Yes | Recommendations |

### Frontend

No environment variables required. API calls use relative URLs.

---

## 5. Deployment on Vercel

### Static Frontend
- Vite builds React app into `dist/`
- Includes `public/graph_cache.json`

### Python Serverless
- `api/index.py` imports Flask app from `backend.app`
- `vercel.json` rewrites `/api/(.*)` to `api/index.py`
- Includes `backend/**` and `public/graph_cache.json` in function

### Routing

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index.py" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## 6. Feature Summary

| Feature | Status | Notes |
|---------|--------|-------|
| Graph serving | ✅ | Cache-first, lazy loading |
| RAG chat | ✅ | Bedrock with document filter |
| Recommendations | ✅ | Bedrock + frontend fallback |
| PDF access | ✅ | S3 presigned URLs |
| VR mode | ✅ | Available at `/vr` |
| Cache rebuild | ❌ | Disabled (read-only filesystem) |

---

**Document Version**: 2.0  
**Last Updated**: December 2025
