# Paper Pigeon

Interactive research network explorer with resume-driven recommendations, RAG-powered paper chat, and rich researcher/lab profiles.

## Features

- Research Network Graph
  - 3D ForceGraph with labs and researchers, hover profiles, and clickable nodes
  - Smart highlighting from search and keyboard navigation

- Search & Quick Select
  - Fast typeahead for researchers, labs, and tags
  - Enter to select, arrow keys to navigate

- Resume Upload & Recommendations
  - Shadcn-styled upload button next to the search bar
  - Client-side PDF parsing; resume text runs through Bedrock RAG or a local similarity fallback
  - Recommendations modal with similarity scores; names clickable to open profiles

- Paper Chat (RAG)
  - Ask questions about a paper; responses include citations
  - Uses Bedrock Retrieve-and-Generate with your knowledge base

- Researcher Profiles
  - Full modal with contact info, labs, tags, publications, and influence score
  - Hover panel for quick glance; clickable items to open full modal or paper chat

## Tech Stack

- React 19, TypeScript, Vite 7
- Tailwind CSS v4 (+ shadcn/ui components)
- AWS SDK v3 (Bedrock Agent Runtime, DynamoDB, S3)
- 3d-force-graph, three.js for visualization
- pdfjs-dist for client-side PDF parsing

## Environment Variables

Required for AWS integrations (set in `.env`):

- VITE_AWS_REGION
- VITE_AWS_ACCESS_KEY_ID
- VITE_AWS_SECRET_ACCESS_KEY
- VITE_BEDROCK_MODEL_ID (optional; defaults to `meta.llama3-1-70b-instruct-v1:0`)
- VITE_BEDROCK_KNOWLEDGE_BASE_ID (primary KB)
- VITE_BEDROCK_DATA_SOURCE_ID (primary DS)
- VITE_BEDROCK_KNOWLEDGE_BASE_ID_2 (recommendations KB)
- VITE_BEDROCK_DATA_SOURCE_ID_2 (recommendations DS)

## Data Tables (DynamoDB)

- `researchers`: { researcher_id, name, advisor, contact_info[], labs[], standing, tags[], influence, about }
- `papers`: { document_id, title, year, tags[], lab_id }
- `library`: { researcher_id, document_id }
- `paper-edges`: { researcher_one_id, researcher_two_id }
- `advisor_edges`: { advisee_id, advisor_id }
- `lab-info`: { lab_id, description, faculty[] }

## Development

Install dependencies and run locally:

```bash
pnpm install
pnpm dev
```

Or with npm/yarn:

```bash
npm i && npm run dev
# or
yarn && yarn dev
```

## Building

```bash
pnpm build
pnpm preview
```
