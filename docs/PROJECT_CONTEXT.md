# Paper Pigeon - Project Context

> **Complete project summary and current status**  
> Last updated: December 2025

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Backend API](#backend-api)
4. [Frontend Components](#frontend-components)
5. [Graph Data Schema](#graph-data-schema)
6. [AWS Integrations](#aws-integrations)
7. [Deployment](#deployment)
8. [Development Guide](#development-guide)

---

## System Overview

**Paper Pigeon** is a research network visualization application that displays relationships between researchers, labs, papers, and academic collaborations.

### Core Functionality

- **3D Interactive Graph**: Visualize researcher networks with nodes (researchers, labs) and edges (paper collaborations, advisor relationships)
- **Researcher Profiles**: View detailed information about researchers, their papers, tags, and contact info
- **Paper Chat**: RAG-based Q&A system for querying research papers via AWS Bedrock
- **Resume Matching**: Upload resume text to find matching researchers
- **PDF Access**: Generate presigned S3 URLs for viewing research papers
- **VR Mode**: Optional VR visualization available at `/vr` route

### Technology Stack

- **Frontend**: React 19 + TypeScript, Vite 7, Three.js (3D graph), Tailwind CSS
- **Backend**: Flask Python, deployed as Vercel Serverless Functions
- **Data Storage**: AWS DynamoDB (researchers, papers, edges), AWS S3 (PDFs)
- **AI/ML**: AWS Bedrock (RAG chat, recommendations)
- **Deployment**: Vercel (static frontend + Python serverless)

---

## Architecture

### Current Architecture (Vercel)

```
┌─────────────────────────────────────────────────────────────────┐
│                         Vercel                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Static Frontend (Vite Build)                                  │
│   ├── index.html                                                │
│   ├── assets/*.js, *.css                                        │
│   └── graph_cache.json                                          │
│                                                                  │
│   Python Serverless Functions                                    │
│   └── api/index.py                                              │
│       └── Flask app (backend.app)                               │
│           ├── /api/graph/data                                   │
│           ├── /api/rag/chat                                     │
│           ├── /api/recommendations/from-resume                   │
│           └── /api/pdf/url                                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ AWS SDK (boto3)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         AWS                                      │
├─────────────────────────────────────────────────────────────────┤
│   DynamoDB          S3                 Bedrock                  │
│   ├── researchers   └── PDFs           ├── Knowledge Base 1    │
│   ├── papers            (presigned)    │   (paper chat)        │
│   ├── paper-edges                      └── Knowledge Base 2    │
│   ├── advisor_edges                        (recommendations)   │
│   ├── library                                                   │
│   └── lab-info                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### File Structure

```
paper-pigeon/
├── api/
│   └── index.py                      # Vercel serverless entry point
│
├── backend/
│   ├── app.py                        # Flask app, graph endpoints
│   ├── graph_core.py                 # Graph builder (DynamoDB → JSON)
│   ├── cache/
│   │   └── graph_cache.json          # Local cache (development)
│   ├── controllers/
│   │   ├── pdf_controller.py         # /api/pdf/url
│   │   ├── rag_controller.py         # /api/rag/chat
│   │   └── recommendations_controller.py
│   └── services/
│       ├── dynamodb_service.py       # DynamoDB queries
│       ├── s3_service.py             # S3 presigned URLs
│       └── bedrock_service.py        # Bedrock RAG
│
├── src/
│   ├── main.tsx                      # React entry point
│   ├── App.tsx                       # Root component with routing
│   ├── components/
│   │   ├── ResearchNetworkGraph.tsx  # Main 3D graph
│   │   ├── VRGraph.tsx               # VR graph mode
│   │   ├── SearchBar.tsx             # Search + resume upload
│   │   ├── ResearcherModal.tsx       # Researcher detail modal
│   │   ├── PaperChatModal.tsx        # RAG chat interface
│   │   └── ...
│   └── services/
│       ├── dynamodb.ts               # Frontend API client
│       └── pdf.ts                    # Client-side PDF parsing
│
├── public/
│   └── graph_cache.json              # Static graph data
│
├── vercel.json                       # Vercel configuration
└── requirements.txt                  # Python dependencies
```

---

## Backend API

### Endpoints

#### `GET /api/graph/data`
Returns the cached graph data.

**Response:**
```json
{
  "nodes": [...],
  "links": [...]
}
```

**Behavior:**
- Loads from `backend/cache/graph_cache.json` (local)
- Falls back to `public/graph_cache.json` (Vercel)
- Returns empty graph if no cache found

#### `POST /api/graph/rebuild-cache`
**Status:** Disabled on Vercel (read-only filesystem)

Returns:
```json
{
  "ok": false,
  "reason": "cache writing disabled on Vercel"
}
```

#### `POST /api/graph/paper-lab-id`
Gets the lab_id for a paper.

**Request:**
```json
{ "document_id": "paper_123" }
```

**Response:**
```json
{ "lab_id": "aims_lab" }
```

#### `POST /api/rag/chat`
Paper-specific RAG chat using Bedrock.

**Request:**
```json
{
  "query": "What is the main contribution?",
  "document_id": "paper_123"
}
```

**Response:**
```json
{
  "answer": "The paper presents...",
  "citations": [...]
}
```

#### `POST /api/recommendations/from-resume`
Recommends researchers based on resume text.

**Request:**
```json
{ "resume_text": "..." }
```

**Response:**
```json
{
  "recommendations": [
    { "name": "Alice Smith", "score": 0.85 },
    ...
  ]
}
```

#### `POST /api/pdf/url`
Generates presigned S3 URL for a paper PDF.

**Request:**
```json
{
  "lab_id": "aims_lab",
  "document_id": "paper_123"
}
```

**Response:**
```json
{ "url": "https://s3.amazonaws.com/..." }
```

#### `GET /health`
Health check endpoint.

**Response:**
```json
{ "status": "ok" }
```

---

## Frontend Components

### Core Components

| Component | Description |
|-----------|-------------|
| `ResearchNetworkGraph.tsx` | Main 3D graph visualization with ForceGraph3D |
| `VRGraph.tsx` | VR mode visualization at `/vr` route |
| `SearchBar.tsx` | Search input with resume upload functionality |
| `ResearcherModal.tsx` | Full researcher profile modal |
| `ResearcherProfilePanel.tsx` | Hover panel for quick researcher info |
| `PaperChatModal.tsx` | RAG chat interface for papers |
| `RecommendationsModal.tsx` | Resume-based recommendations display |
| `LabModal.tsx` | Lab information modal |
| `AccessibilityPanel.tsx` | Accessibility settings panel |

### Routing

```tsx
<BrowserRouter>
  <Routes>
    <Route path="/" element={<ResearchNetworkGraph />} />
    <Route path="/vr" element={<VRGraph />} />
  </Routes>
</BrowserRouter>
```

---

## Graph Data Schema

### Node Types

**Researcher Node:**
```typescript
{
  id: string;              // researcher_id
  name: string;
  type: "researcher";
  val: 1;
  advisor?: string;
  contact_info?: string[];
  labs?: string[];
  standing?: string;
  papers?: Paper[];
  tags?: string[];
  influence?: number;
  about?: string;
}
```

**Lab Node:**
```typescript
{
  id: string;              // lab_id
  name: string;
  type: "lab";
  val: 2;
}
```

### Link Types

```typescript
{
  source: string;
  target: string;
  type: "paper" | "advisor" | "researcher_lab";
}
```

- `paper`: Two researchers co-authored a paper
- `advisor`: Advisee → Advisor relationship
- `researcher_lab`: Researcher belongs to lab

---

## AWS Integrations

### DynamoDB Tables

| Table | Partition Key | Sort Key | Purpose |
|-------|--------------|----------|---------|
| `researchers` | `researcher_id` | - | Researcher metadata |
| `papers` | `document_id` | - | Paper metadata |
| `paper-edges` | `researcher_one_id` | `researcher_two_id` | Co-authorship |
| `advisor_edges` | `advisee_id` | `advisor_id` | Advisor relationships |
| `library` | `researcher_id` | `document_id` | Researcher → Paper mapping |
| `lab-info` | `lab_id` | - | Lab descriptions |
| `descriptions` | `researcher_id` | - | Researcher about text |
| `metrics` | `researcher_id` | - | Influence scores |

### Bedrock Knowledge Bases

- **Primary KB** (`BEDROCK_KNOWLEDGE_BASE_ID`): Paper chat
- **Secondary KB** (`BEDROCK_KNOWLEDGE_BASE_ID_2`): Resume recommendations

### S3 Structure

```
{bucket}/
├── {lab_id}/
│   ├── {document_id}.pdf
│   └── ...
└── ...
```

---

## Deployment

### Vercel Configuration (`vercel.json`)

```json
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/index.py" },
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "functions": {
    "api/index.py": {
      "includeFiles": "backend/**,public/graph_cache.json"
    }
  }
}
```

### Environment Variables

Set in Vercel Dashboard:

| Variable | Required | Description |
|----------|----------|-------------|
| `AWS_ACCESS_KEY_ID` | Yes | AWS credentials |
| `AWS_SECRET_ACCESS_KEY` | Yes | AWS credentials |
| `AWS_REGION` | Yes | AWS region |
| `S3_BUCKET_NAME` | Yes | PDF bucket |
| `BEDROCK_KNOWLEDGE_BASE_ID` | Yes | Paper chat KB |
| `BEDROCK_KNOWLEDGE_BASE_ID_2` | Yes | Recommendations KB |

### Deploy Process

1. Push to connected Git repository
2. Vercel builds frontend with `pnpm build`
3. Vercel deploys `api/index.py` as Python serverless function
4. Static files served from Vite build output
5. API calls routed to serverless function

---

## Development Guide

### Local Development

```bash
# Frontend
pnpm install
pnpm dev

# Backend (separate terminal)
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python backend/app.py
```

### Rebuilding Graph Cache

The graph cache is pre-built and stored in `public/graph_cache.json`. To rebuild:

```bash
python backend/graph_core.py
```

This requires AWS credentials with DynamoDB read access.

### Testing

```bash
# Type checking
pnpm build

# Lint
pnpm lint
```

---

## Key Design Decisions

1. **Cache-First Architecture**: Graph data is pre-computed and served from static JSON to avoid slow DynamoDB queries on every request.

2. **Lazy Loading**: Graph cache loads on first request, not at import time, to avoid serverless cold start issues.

3. **Read-Only on Vercel**: Cache writing is disabled because Vercel serverless has a read-only filesystem.

4. **Relative API URLs**: Frontend uses relative URLs (`/api/...`) to work on any domain without configuration.

5. **CORS Allow All**: Backend allows all origins (`*`) since Vercel handles domain security.

6. **Environment Variable Fallbacks**: Backend checks both `AWS_*` and `VITE_*` prefixed environment variables for flexibility.

---

**Document maintained by**: Development Team  
**Last major update**: December 2025
