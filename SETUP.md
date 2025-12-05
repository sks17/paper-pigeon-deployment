# Paper Pigeon - Setup Guide

A 3D interactive visualization of research networks, built with React, TypeScript, Flask, and 3d-force-graph.

## Features

- **3D Interactive Graph**: Full-screen 3D visualization of research collaborations
- **Flask Backend**: Python API with AWS integrations (DynamoDB, S3, Bedrock)
- **Node Labels**: Displays researcher names on graph nodes
- **Interactive Controls**: Click to focus on nodes, drag to move around
- **VR Mode**: Optional VR visualization at `/vr` route
- **RAG Chat**: Ask questions about research papers
- **Resume Matching**: Upload resume to find matching researchers

## Quick Start

### 1. Install Dependencies

```bash
# Frontend
pnpm install

# Backend (optional for local development)
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Run Development Server

```bash
# Frontend only (uses deployed API or static cache)
pnpm dev

# Backend (separate terminal, if needed)
python backend/app.py
```

The application will be available at `http://localhost:5173`

## Vercel Deployment

### Environment Variables

Set these in Vercel Dashboard → Settings → Environment Variables:

| Variable | Description |
|----------|-------------|
| `AWS_ACCESS_KEY_ID` | AWS IAM access key |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret key |
| `AWS_REGION` | AWS region (e.g., `us-west-2`) |
| `S3_BUCKET_NAME` | S3 bucket containing PDF files |
| `BEDROCK_KNOWLEDGE_BASE_ID` | Primary Bedrock knowledge base |
| `BEDROCK_KNOWLEDGE_BASE_ID_2` | Secondary KB for recommendations |

### Deploy

Push to your connected Git repository. Vercel will:
1. Build the React frontend with Vite
2. Deploy Flask as a Python serverless function
3. Serve the graph cache from `public/graph_cache.json`

## Usage

### Mouse Controls
- **Left click and drag**: Rotate the view
- **Right click and drag**: Pan
- **Scroll**: Zoom in/out

### Node Interaction
- **Hover**: Show researcher profile panel
- **Click researcher**: Open full profile modal
- **Click lab**: Open lab information modal

### Search
- Type to search researchers, labs, or tags
- Use arrow keys to navigate results
- Press Enter to select

### Resume Upload
- Click the upload button next to search
- Upload a PDF resume
- View matched researchers based on research interests

### Paper Chat
- Click a paper in a researcher's profile
- Ask questions about the paper
- View AI-generated answers with citations

## Data Structure

### Graph Cache (`public/graph_cache.json`)

The graph data follows this schema:

```typescript
interface GraphData {
  nodes: Array<{
    id: string;              // researcher_id or lab_id
    name: string;            // display name
    type: 'researcher' | 'lab';
    val: number;             // 1 for researchers, 2 for labs
    // Researcher fields:
    advisor?: string;
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
    type: 'paper' | 'advisor' | 'researcher_lab';
  }>;
}
```

## Troubleshooting

### Common Issues

1. **"Failed to load research network data"**
   - Check that the backend is running (local) or Vercel environment variables are set
   - Verify `public/graph_cache.json` exists

2. **Empty graph**
   - Check browser console for errors
   - Verify graph cache has data

3. **API errors (500)**
   - Check Vercel function logs for detailed error messages
   - Verify AWS credentials and permissions
   - Ensure Bedrock knowledge bases are set up correctly

4. **CORS errors**
   - Backend is configured to allow all origins (`*`)
   - If issues persist, check Vercel deployment logs

### Local Development

For local development without AWS:
- The graph will load from `public/graph_cache.json`
- RAG chat and recommendations will fail (require AWS credentials)
- PDF links will not work (require S3 access)

## Technologies Used

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite 7** - Build tool
- **3d-force-graph** - 3D graph visualization
- **three.js** - 3D graphics
- **Flask** - Python backend
- **boto3** - AWS SDK for Python
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components
