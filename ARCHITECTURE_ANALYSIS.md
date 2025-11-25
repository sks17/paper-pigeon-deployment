## Paper Pigeon - Architecture & Deployment Overview

**Purpose**: Document the current architecture of Paper Pigeon for deployment and maintenance.  
**Architecture**: React + Vite frontend, Flask backend on Vercel Python Serverless Functions.  
**Data Plane**: Precomputed research graph served from a static JSON cache; AWS is used for RAG, recommendations, and PDF access.

---

## 1. Directory Map (Conceptual)

```text
paper-pigeon/
├── backend/                          # Flask Python backend
│   ├── app.py                        # Flask app, graph endpoints, health check
│   ├── graph_core.py                 # Graph builder (DynamoDB → JSON)
│   ├── build_graph_cache.py          # Local script to rebuild graph cache
│   ├── cache/
│   │   └── graph_cache.json          # Optional local graph cache
│   ├── controllers/                  # Flask blueprints
│   │   ├── pdf_controller.py         # /api/pdf/url → S3 presigned URLs
│   │   ├── rag_controller.py         # /api/rag/chat → Bedrock RAG chat
│   │   └── recommendations_controller.py  # /api/recommendations/from-resume
│   ├── services/                     # AWS service wrappers
│   │   ├── dynamodb_service.py       # DynamoDB queries & caching
│   │   ├── s3_service.py             # S3 presigned URL generation
│   │   └── bedrock_service.py        # Bedrock RetrieveAndGenerate calls
│   └── utils/                        # Misc utilities (currently minimal/unused)
│
├── api/
│   └── index.py                      # Vercel Python serverless entry (imports backend_wrapper.app)
├── backend_wrapper.py                # Thin wrapper exposing Flask app for Vercel
│
├── src/                              # React + TypeScript frontend
│   ├── main.tsx                      # React entry point
│   ├── App.tsx                       # Root component (AccessibilityProvider + graph)
│   ├── components/
│   │   ├── ResearchNetworkGraph.tsx  # Main 3D graph visualization & orchestration
│   │   ├── SearchBar.tsx             # Search & resume upload
│   │   ├── ResearcherProfilePanel.tsx# Hover profile panel
│   │   ├── ResearcherModal.tsx       # Researcher detail modal
│   │   ├── PaperChatModal.tsx        # RAG chat interface
│   │   ├── RecommendationsModal.tsx  # Resume-based recommendations
│   │   ├── LabModal.tsx              # Lab information modal
│   │   ├── AccessibilityPanel.tsx    # Accessibility settings
│   │   └── ui/                       # shadcn/ui primitives
│   ├── services/
│   │   ├── dynamodb.ts               # Frontend API client (no direct AWS)
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
  - Creates a `Flask` app and enables CORS (currently targeted at `http://localhost:5173` for local dev).
  - Registers three blueprints:
    - `/api/rag/*` → `rag_controller`
    - `/api/recommendations/*` → `recommendations_controller`
    - `/api/pdf/*` → `pdf_controller`
  - Exposes `/api/graph/*` endpoints and `/health` directly on the app.

- **Graph cache state**:
  - Uses a module-level `_graph_cache` that is **lazily loaded** on first request to `/api/graph/data`.

### 2.2 Graph Cache Loading

- **Function**: `load_graph_cache()`
- **Behavior**:
  - Attempts to load `backend/cache/graph_cache.json` first.
  - If that fails or is absent, falls back to `public/graph_cache.json` (shared with the frontend build).
  - If both are unavailable or invalid, logs a warning and sets `_graph_cache` to `{"nodes": [], "links": []}`.
- **Runtime impact**:
  - Once loaded, the cache is kept in memory for all subsequent requests in the same serverless instance.
  - No DynamoDB calls are made on reads; all graph fetching is cache-first and read-only.

### 2.3 Core API Endpoints

- **`GET /api/graph/data`**
  - **Purpose**: Serve the precomputed research network graph.
  - **Source**: In-memory `_graph_cache`, backed by the static JSON file(s) described above.
  - **Notes**: If the cache cannot be loaded, returns an empty graph structure.

- **`POST /api/graph/rebuild-cache`**
  - **Purpose**: Rebuild the graph cache from DynamoDB.
  - **Current behavior**: Disabled on Vercel – always returns HTTP 503 with a message explaining that cache writing is not supported on the read-only filesystem.

- **`POST /api/graph/paper-lab-id`**
  - **Purpose**: Resolve a paper’s `document_id` to its `lab_id`.
  - **Flow**: Validates `document_id`, calls `dynamodb_service.fetch_papers([document_id])`, and returns the `lab_id` from the first result (or `null`).

- **`POST /api/rag/chat`**
  - **Controller**: `backend/controllers/rag_controller.py`
  - **Purpose**: Paper-specific retrieval-augmented chat.
  - **Flow**:
    - Validates JSON body with `query` and `document_id`.
    - Calls `bedrock_service.rag_chat(query, document_id)`.
    - Returns `{ "answer": string, "citations": [...] }`.
  - **Diagnostics**: Logs payload summary, timings, and errors when `NODE_ENV != 'production'`.

- **`POST /api/recommendations/from-resume`**
  - **Controller**: `backend/controllers/recommendations_controller.py`
  - **Purpose**: Recommend researchers from resume text.
  - **Flow**:
    - Validates `resume_text` in the JSON body.
    - Calls `bedrock_service.rag_recommend(resume_text)` and returns its `"recommendations"`.

- **`POST /api/pdf/url`**
  - **Controller**: `backend/controllers/pdf_controller.py`
  - **Purpose**: Provide a presigned S3 URL for a given lab and document ID.
  - **Flow**:
    - Validates `lab_id` and `document_id`.
    - Calls `s3_service.get_presigned_pdf_url(lab_id, document_id)`.
    - Returns `{ "url": "<presigned-url>" }`.

- **`GET /health`**
  - Simple health check returning `{ "status": "ok" }`.

### 2.4 AWS Service Layer

- **DynamoDB (`backend/services/dynamodb_service.py`)**:
  - Lazy `boto3.resource("dynamodb", region_name=AWS_REGION)` via `get_dynamodb()`.
  - In-memory caches for researchers, papers, and library entries.
  - High-level helpers:
    - `fetch_researchers()`, `fetch_paper_edges()`, `fetch_advisor_edges()`
    - `fetch_library_entries(researcher_id)`
    - `_batch_get(table_name, key_name, key_values)`
    - `fetch_papers(document_ids)`, `fetch_descriptions(researcher_ids)`, `fetch_metrics(researcher_ids)`
    - `fetch_lab_info(lab_ids)` for lab metadata.

- **S3 (`backend/services/s3_service.py`)**:
  - Creates a client using `AWS_REGION`.
  - Uses `S3_BUCKET_NAME` and key pattern `{lab_id}/{document_id}.pdf` to generate presigned URLs (1 hour validity).

- **Bedrock (`backend/services/bedrock_service.py`)**:
  - `_get_bedrock_client()` builds a `bedrock-agent-runtime` client using `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_REGION` (lazy, with diagnostics in non-production).
  - `rag_chat(query, document_id)`:
    - Uses `BEDROCK_KNOWLEDGE_BASE_ID` and `BEDROCK_DATA_SOURCE_ID`.
    - Calls `retrieve_and_generate` with a filter on `document_id` and returns structured `{"answer", "citations"}`.
  - `rag_recommend(resume_text)`:
    - Uses `BEDROCK_KNOWLEDGE_BASE_ID_2` and a fixed model ARN derived from `AWS_REGION`.
    - Expects JSON output containing `"recommendations"`; falls back to an empty list if parsing fails.

### 2.5 Graph Construction (`backend/graph_core.py`)

- **Function**: `build_graph_data_pure()`
- **Responsibilities**:
  - Fetch researchers, paper edges, advisor edges, descriptions, and metrics from DynamoDB.
  - For each researcher:
    - Fetch library entries → derive document IDs.
    - Batch fetch papers and normalize them to `{title, year, document_id, tags}`.
    - Aggregate tags and attach `about` and `influence` fields.
  - Add static lab nodes from a hardcoded list, matching frontend expectations.
  - Build links:
    - `type: "paper"` (researcher–researcher).
    - `type: "advisor"` (advisee–advisor).
    - `type: "researcher_lab"` (researcher–lab).
  - Return `{"nodes": [...], "links": [...]}` consistent with the frontend’s `GraphData` type.

---

## 3. Frontend Architecture & Data Flow

### 3.1 App Bootstrap

- `src/main.tsx` mounts `App` into the DOM.
- `src/App.tsx` wraps the app in `AccessibilityProvider` and renders `ResearchNetworkGraph` full-screen.

### 3.2 Graph Visualization (`ResearchNetworkGraph.tsx`)

- **Data loading**:
  - On mount, calls `fetchGraphData()` from `src/services/dynamodb.ts`.
  - `fetchGraphData()` performs `GET ${import.meta.env.VITE_API_URL}/api/graph/data` and logs basic diagnostics.

- **Rendering**:
  - Uses `3d-force-graph`, `three`, and `three-spritetext` to render a 3D network.
  - Distinguishes labs and researchers with different geometries/colors and supports highlight effects.

- **Interactions**:
  - Hovering researcher nodes shows `ResearcherProfilePanel`.
  - Clicking researcher nodes opens `ResearcherModal`; clicking lab nodes opens `LabModal` and triggers lab info loading.
  - Integrates accessibility settings (high contrast, colorblind mode, reduced motion) from `AccessibilityContext` and toggles `AccessibilityPanel` from a floating button.

### 3.3 Search, Resume Upload, and Recommendations

- **SearchBar.tsx**:
  - Consumes `graphData` to perform client-side filtering by name, labs, and tags.
  - Emits callbacks for node selection, highlighting, and resume text parsing.

- **Resume → recommendations flow**:
  - `parsePdf(file)` in `src/services/pdf.ts` uses `pdfjs-dist` to extract text from uploaded resumes.
  - `handleResumeParsed(text)` in `ResearchNetworkGraph`:
    - Calls `POST ${VITE_API_URL}/api/recommendations/from-resume` with `{ resume_text: text }`.
    - If the backend returns no recommendations, falls back to a local similarity heuristic over researcher tags and `about` fields to compute scores.
  - Results are displayed in `RecommendationsModal`, with navigation hooks into the graph.

### 3.4 Researcher Details, PDFs, and Chat

- **ResearcherProfilePanel.tsx & ResearcherModal.tsx**:
  - Display researcher metadata, labs, influence, and associated papers from `graphData`.
  - Trigger `onPaperChat(paper)` to open `PaperChatModal`.

- **PaperChatModal.tsx**:
  - Sends `POST ${VITE_API_URL}/api/rag/chat` with `{ query, document_id }`.
  - Renders the returned `"answer"` and `"citations"`.

- **LabModal.tsx**:
  - Opens for lab nodes or search results.
  - Dynamically imports `DynamoDBService` from `src/services/dynamodb.ts` and calls `fetchLabInfos` (currently a stub returning `[]`), while also mapping faculty IDs in the cached graph to researcher nodes.

- **PDF access**:
  - When a paper is selected, components call `POST ${VITE_API_URL}/api/pdf/url` with `{ lab_id, document_id }`.
  - The returned presigned URL is opened in a new tab for PDF viewing.

### 3.5 Frontend API Client (`src/services/dynamodb.ts`)

- Defines `Paper`, `Researcher`, `Node`, `Link`, and `GraphData` to mirror the backend shape.
- Implements:
  - `fetchGraphData()` → `GET /api/graph/data`.
  - `fetchPaperLabId(documentId)` → `POST /api/graph/paper-lab-id`.
  - `DynamoDBService.fetchLabInfos()` → stub returning an empty array, intended to be backed by a future backend endpoint.

---

## 4. Environment & Configuration

### 4.1 Backend Environment Variables (`os.getenv`)

- **AWS & Bedrock**:
  - `AWS_REGION` – required by DynamoDB, S3, and Bedrock clients.
  - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` – used explicitly for the Bedrock client.
  - `BEDROCK_KNOWLEDGE_BASE_ID`, `BEDROCK_DATA_SOURCE_ID` – primary knowledge base and data source for paper chat.
  - `BEDROCK_KNOWLEDGE_BASE_ID_2` – secondary knowledge base for resume recommendations.

- **S3**:
  - `S3_BUCKET_NAME` – bucket containing PDFs at `{lab_id}/{document_id}.pdf`.

All backend configuration is expected to be supplied via Vercel environment variables; there is no `.env` loading at import time in the production path.

### 4.2 Frontend Environment Variables (`import.meta.env`)

- `VITE_API_URL` – base URL for all backend requests (e.g., `https://<project>.vercel.app`).
  - Used across `src/services/dynamodb.ts` and components that call `/api/*` endpoints.
  - Must be defined at build time; changing it requires rebuilding the frontend.

---

## 5. Deployment Topology on Vercel

- **Static frontend**:
  - Vite builds the React app into static assets.
  - Vercel serves these from the project root, including `public/graph_cache.json`.

- **Python backend**:
  - `api/index.py` is the Vercel serverless entrypoint; it imports `backend_wrapper.app`.
  - `backend_wrapper.py` simply re-exports the Flask `app` from `backend.app`.
  - `vercel.json` rewrites all `/api/(.*)` requests to `api/index.py`, which then routes via Flask.

This yields a clean split: the **frontend** handles visualization and UX, while the **backend** handles graph serving, AWS integration, and long-running work as serverless functions.

---

## 6. Feature Snapshot & Readiness

- **Graph serving**: Precomputed graph served via `/api/graph/data` with lazy in-memory caching and static-file fallback; no DynamoDB reads on user requests.
- **RAG chat**: `/api/rag/chat` wired to Bedrock using environment-driven configuration and rich diagnostics outside production.
- **Recommendations**: `/api/recommendations/from-resume` plus a robust frontend fallback when Bedrock returns no usable data.
- **PDF access**: `/api/pdf/url` provides time-limited S3 URLs keyed by lab and document.
- **VR**: All VR-related code and dependencies have been removed.
- **Imports & paths**: Python imports consistently use `backend.*` to align with Vercel’s module resolution.

Overall, Paper Pigeon is structured as a **Vite-powered static frontend** talking to a **Flask-based serverless backend** on Vercel, with a cache-first graph layer and environment-driven AWS integration.


