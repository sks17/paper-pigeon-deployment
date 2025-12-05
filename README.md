# Paper Pigeon

Interactive research network explorer with resume-driven recommendations, RAG-powered paper chat, and rich researcher/lab profiles.

## Features

- **Research Network Graph**
  - 3D ForceGraph with labs and researchers, hover profiles, and clickable nodes
  - Smart highlighting from search and keyboard navigation
  - VR mode available at `/vr` route

- **Search & Quick Select**
  - Fast typeahead for researchers, labs, and tags
  - Enter to select, arrow keys to navigate

- **Resume Upload & Recommendations**
  - Client-side PDF parsing; resume text runs through Bedrock RAG
  - Recommendations modal with similarity scores; names clickable to open profiles

- **Paper Chat (RAG)**
  - Ask questions about a paper; responses include citations
  - Uses Bedrock Retrieve-and-Generate with knowledge base

- **Researcher Profiles**
  - Full modal with contact info, labs, tags, publications, and influence score
  - Hover panel for quick glance; clickable items to open full modal or paper chat

## Architecture

```
Frontend (React + Vite)        Backend (Flask on Vercel)
        │                              │
        │  /api/graph/data            │
        ├─────────────────────────────┤ Graph cache (JSON)
        │                              │
        │  /api/rag/chat              │
        ├─────────────────────────────┤ AWS Bedrock
        │                              │
        │  /api/recommendations       │
        ├─────────────────────────────┤ AWS Bedrock
        │                              │
        │  /api/pdf/url               │
        └─────────────────────────────┤ AWS S3 (presigned)
```

- **Frontend**: React 19 + TypeScript, hosted as static files on Vercel
- **Backend**: Flask Python app running as Vercel Serverless Functions
- **Data**: AWS DynamoDB (researchers, papers), S3 (PDFs), Bedrock (RAG)

## Tech Stack

- React 19, TypeScript, Vite 7
- Tailwind CSS v4 (+ shadcn/ui components)
- 3d-force-graph, three.js for visualization
- pdfjs-dist for client-side PDF parsing
- Flask, Flask-CORS for backend API
- boto3 for AWS integrations

## Environment Variables

### Frontend (Vite - build time)

No frontend environment variables required. All API calls use relative URLs.

### Backend (Vercel - runtime)

Set these in Vercel Dashboard → Settings → Environment Variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `AWS_ACCESS_KEY_ID` | Yes | AWS IAM access key |
| `AWS_SECRET_ACCESS_KEY` | Yes | AWS IAM secret key |
| `AWS_REGION` | Yes | AWS region (e.g., `us-west-2`) |
| `S3_BUCKET_NAME` | Yes | S3 bucket containing PDF files |
| `BEDROCK_KNOWLEDGE_BASE_ID` | Yes | Primary Bedrock KB for paper chat |
| `BEDROCK_DATA_SOURCE_ID` | No | Data source ID (optional) |
| `BEDROCK_KNOWLEDGE_BASE_ID_2` | Yes | Secondary KB for recommendations |

## Data Tables (DynamoDB)

- `researchers`: `{ researcher_id, name, advisor, contact_info[], labs[], standing, tags[], influence, about }`
- `papers`: `{ document_id, title, year, tags[], lab_id }`
- `library`: `{ researcher_id, document_id }`
- `paper-edges`: `{ researcher_one_id, researcher_two_id }`
- `advisor_edges`: `{ advisee_id, advisor_id }`
- `lab-info`: `{ lab_id, description, faculty[] }`

## Development

### Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)
- Python 3.12+ (for local backend)

### Install and Run

```bash
# Install frontend dependencies
pnpm install

# Start frontend dev server
pnpm dev
```

For local backend development:

```bash
# Create Python virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Run Flask backend
python backend/app.py
```

The frontend runs at `http://localhost:5173` and the backend at `http://localhost:5000`.

## Building

```bash
pnpm build
pnpm preview
```

## Deployment

This project deploys to Vercel with:
- Static frontend from Vite build
- Python serverless functions for the API

See `vercel.json` for configuration and `ARCHITECTURE_ANALYSIS.md` for detailed deployment documentation.

## Project Structure

```
paper-pigeon/
├── api/
│   └── index.py              # Vercel serverless entry point
├── backend/
│   ├── app.py                # Flask application
│   ├── graph_core.py         # Graph builder
│   ├── controllers/          # API route handlers
│   └── services/             # AWS service wrappers
├── src/
│   ├── components/           # React components
│   ├── services/             # Frontend API client
│   └── contexts/             # React contexts
├── public/
│   └── graph_cache.json      # Static graph data
├── vercel.json               # Vercel configuration
└── requirements.txt          # Python dependencies
```

## License

MIT
