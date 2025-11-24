# Paper Pigeon - Project Context

> **Complete project summary and current status**  
> Last updated: November 2025

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Evolution](#architecture-evolution)
3. [Caching Strategy](#caching-strategy)
4. [Backend Architecture](#backend-architecture)
5. [Frontend Graph Schema](#frontend-graph-schema)
6. [Debugging History](#debugging-history)
7. [AWS Deployment Progress](#aws-deployment-progress)
8. [Where We Left Off](#where-we-left-off) ⚠️
9. [Future Roadmap](#future-roadmap)

---

## System Overview

**Paper Pigeon** is a research network visualization application that displays relationships between researchers, labs, papers, and academic collaborations at the University of Washington.

### Core Functionality

- **3D Interactive Graph**: Visualize researcher networks with nodes (researchers, labs) and edges (paper collaborations, advisor relationships)
- **Researcher Profiles**: View detailed information about researchers, their papers, tags, and contact info
- **Paper Chat**: RAG-based Q&A system for querying research papers
- **Resume Matching**: Upload resume text to find matching researchers and labs
- **PDF Access**: Generate presigned S3 URLs for viewing research papers

### Technology Stack

- **Frontend**: React + TypeScript, Vite, Three.js (3D graph), Tailwind CSS
- **Backend**: Python Flask (development), AWS Lambda (production)
- **Data Storage**: AWS DynamoDB (researchers, papers, edges), AWS S3 (PDFs, cache)
- **AI/ML**: AWS Bedrock (RAG chat, recommendations)
- **Deployment**: GitHub Actions → S3 (frontend) + Lambda (backend)

---

## Architecture Evolution

### Old Architecture (Initial Implementation)

```
Frontend (React)
  ├── Direct AWS SDK calls (boto3 via CDN)
  │   ├── DynamoDB queries
  │   ├── S3 operations
  │   └── Bedrock RAG
  └── No backend API layer
```

**Problems:**
- Security risk: AWS credentials exposed in frontend
- Performance: Multiple direct database queries per page load
- Scalability: No caching, no request optimization
- Debugging: Hard to trace errors across client/server boundary

### New Architecture (Current)

```
Frontend (React)
  └── Environment-based API URLs
      ├── Dev: http://localhost:5000 (Flask)
      └── Prod: https://api-gateway-url (Lambda)
            │
            ├── Flask Backend (Development)
            │   ├── /api/graph/data → In-memory cache
            │   ├── /api/rag/chat → Bedrock service
            │   ├── /api/pdf/url → S3 presigned URLs
            │   └── /api/recommendations/from-resume → Bedrock
            │
            └── Lambda Backend (Production)
                └── /api/graph/data → S3 cache read
```

**Improvements:**
- ✅ Secure: AWS credentials only in backend
- ✅ Cached: Graph data pre-computed and served instantly
- ✅ Scalable: Lambda auto-scaling, S3 CDN-ready
- ✅ Debuggable: Centralized logging and error handling

---

## Caching Strategy

### Why Caching Was Essential

1. **Performance**: Building graph from DynamoDB took 30+ seconds
   - Fetching all researchers, papers, edges, descriptions, metrics
   - Complex nested queries and joins
   - Multiple round-trips to DynamoDB

2. **Cost**: Every page load triggered expensive DynamoDB queries
   - High read capacity requirements
   - Unnecessary database load for static data

3. **User Experience**: Long loading times (30s+) caused:
   - Timeout errors
   - Poor UX on slow connections
   - Browser hanging/freezing

4. **Reliability**: Direct DynamoDB calls were unreliable
   - Environment variable loading issues
   - Memory errors with large datasets
   - Network timeouts

### Caching Implementation

**Two-Level Cache Strategy:**

1. **Local Cache** (`backend/cache/graph_cache.json`)
   - Built by `backend/tools/rebuild_graph_cache.py`
   - Used by Flask development server
   - In-memory loading on app startup

2. **S3 Cache** (`s3://bucket-name/graph_cache.json`)
   - Same JSON structure as local cache
   - Read by Lambda function in production
   - Updated via `tools/upload_cache.py`

**Cache Rebuild Process:**
```
1. Rebuild script runs (manual or scheduled)
   └── backend/tools/rebuild_graph_cache.py
       ├── Calls build_graph_data_pure()
       ├── Fetches all data from DynamoDB
       ├── Builds nodes/links JSON
       └── Saves to backend/cache/graph_cache.json

2. Upload to S3 (production)
   └── tools/upload_cache.py
       └── Uploads cache to S3 for Lambda

3. Lambda serves cached data
   └── backend_lambda/lambda_function.py
       └── Reads from S3, returns JSON
```

**Cache Update Frequency:**
- Manual: Developer runs rebuild script when data changes
- Scheduled: Cron/systemd timer runs daily
- Future: Trigger on DynamoDB table updates (EventBridge)

---

## Backend Architecture

### Development Backend (`backend/`)

**File Structure:**
```
backend/
├── app.py                    # Flask app, cache-first API
├── graph_core.py             # Pure graph building logic
├── services/
│   ├── dynamodb_service.py   # DynamoDB queries (with in-memory cache)
│   ├── s3_service.py         # S3 operations
│   └── bedrock_service.py    # Bedrock RAG/recommendations
├── controllers/
│   ├── rag_controller.py     # /api/rag/chat
│   ├── pdf_controller.py     # /api/pdf/url
│   └── recommendations_controller.py  # /api/recommendations/from-resume
├── cache/
│   └── graph_cache.json      # Local cache file
└── tools/
    ├── rebuild_graph_cache.py    # Cache builder script
    └── logs/
        └── rebuilder.log         # Build logs
```

**Key Components:**

1. **`app.py`** - Flask Application
   - Loads `graph_cache.json` into memory on startup
   - Serves `/api/graph/data` from in-memory cache (no DynamoDB)
   - Provides `/api/graph/rebuild-cache` (POST) for manual rebuilds
   - Registers blueprints for RAG, PDF, recommendations

2. **`graph_core.py`** - Pure Graph Building
   - `build_graph_data_pure()` - No Flask dependencies
   - Fetches researchers, papers, edges from DynamoDB
   - Builds nodes (researchers, labs) and links (paper, advisor edges)
   - Returns `{"nodes": [...], "links": [...]}` dict

3. **`dynamodb_service.py`** - Database Layer
   - In-memory cache for `fetch_researchers()`, `fetch_papers()`, `fetch_library_entries()`
   - Retry logic with exponential backoff
   - Environment variable validation

### Production Backend (`backend_lambda/`)

**Lambda Function (`lambda_function.py`):**
- Reads `graph_cache.json` from S3 bucket
- Returns JSON with CORS headers
- Error handling for missing cache, S3 errors, invalid JSON
- Environment variables: `S3_BUCKET_NAME`, `CACHE_KEY`

**Deployment:**
- Zipped with `requirements.txt` (boto3 only)
- Deployed via GitHub Actions
- Connected to API Gateway

---

## Frontend Graph Schema

The frontend expects a specific JSON structure for nodes and links. See `FRONTEND_GRAPH_SCHEMA.md` for complete documentation.

### Node Types

**Researcher Node:**
```typescript
{
  id: string;              // researcher_id
  name: string;            // display name
  type: "researcher";
  val: 1;                  // rendering size
  advisor?: string;
  contact_info?: string[];
  labs?: string[];         // lab names
  standing?: string;       // "Professor", "PhD Student", etc.
  papers?: Paper[];        // full paper objects
  tags?: string[];         // sorted research area tags
  influence?: number;      // 0-100 score
  about?: string;          // description text
}
```

**Lab Node:**
```typescript
{
  id: string;              // lab_id (e.g., "aims_lab")
  name: string;            // display name (e.g., "AIMS Lab")
  type: "lab";
  val: 2;                  // larger rendering size
}
```

### Link Types

```typescript
{
  source: string;          // source node id
  target: string;          // target node id
  type: "paper" | "advisor" | "researcher_lab";
}
```

**Link Types:**
- `paper`: Two researchers co-authored a paper
- `advisor`: Advisee → Advisor relationship
- `researcher_lab`: Researcher belongs to lab (created client-side)

### Client-Side Transformations

The frontend (`ResearchNetworkGraph.tsx`) performs additional processing:
- Adds `researcher_lab` links based on researcher `labs` field
- Calculates node colors based on labs
- Filters/transforms data for rendering
- Handles missing/optional fields gracefully

**Important:** The backend must match this exact schema. The `graph_core.py` module replicates the frontend's node/link creation logic.

---

## Debugging History

### Initial Problems

1. **Environment Variable Loading Failure**
   - **Symptom**: `AWS_REGION=None`, `NoRegionError` when running debug scripts
   - **Root Cause**: Relative imports bypassed `backend/__init__.py` where `load_dotenv()` was called
   - **Fix**: Updated imports to use absolute paths (`from backend.services import ...`), ensured `sys.path` setup

2. **Slow Graph Loading (30+ seconds)**
   - **Symptom**: Frontend fetch to `/api/graph/data` timed out or took forever
   - **Root Cause**: Live DynamoDB queries for every request, complex nested fetches
   - **Fix**: Implemented cache-first architecture

3. **Memory Errors**
   - **Symptom**: `MemoryError` when building graph with large datasets
   - **Root Cause**: Loading all data into memory without streaming
   - **Fix**: Optimized data fetching, added error handling, implemented cache to avoid rebuilds

4. **Frontend-Backend URL Mismatch**
   - **Symptom**: Fetch requests remained "pending", never reached backend
   - **Root Cause**: Inconsistent URLs (`localhost` vs `127.0.0.1`), missing CORS
   - **Fix**: Standardized on `localhost:5000`, added CORS headers, environment-based URLs

### Solutions Implemented

✅ **Absolute imports**: All backend imports use `backend.*` paths  
✅ **Centralized env loading**: `backend/__init__.py` loads `.env` before any boto3 calls  
✅ **In-memory caching**: DynamoDB service caches researchers, papers, library entries  
✅ **Pre-computed cache**: Graph built offline, served instantly  
✅ **Error handling**: Graceful fallbacks, retry logic, logging  
✅ **Environment-based URLs**: Frontend uses `VITE_API_URL` for dev/prod separation  

### Why Caching Solved Everything

1. **Eliminated slow DynamoDB queries**: Graph served in <100ms from cache
2. **Reduced database load**: No queries during normal page loads
3. **Fixed timeout errors**: Instant responses, no hanging requests
4. **Improved reliability**: Cache rebuild fails gracefully, old cache still served
5. **Easier debugging**: Cache file can be inspected, rebuilt independently

---

## AWS Deployment Progress

### ✅ Completed

1. **Lambda Function Created**
   - `backend_lambda/lambda_function.py` - S3 cache reader
   - `backend_lambda/requirements.txt` - Dependencies
   - `backend_lambda/README.md` - Deployment instructions

2. **Frontend Environment Configuration**
   - `.env` - Development (localhost:5000)
   - `.env.production` - Production (API Gateway URL placeholder)
   - All fetch calls updated to use `import.meta.env.VITE_API_URL`

3. **Cache Management Tools**
   - `backend/tools/rebuild_graph_cache.py` - Cache builder with logging, retries
   - `tools/upload_cache.py` - S3 upload script

4. **GitHub Actions Workflow**
   - `.github/workflows/deploy.yml` - Automated deployment pipeline
   - Builds frontend, uploads to S3, deploys Lambda

5. **Documentation**
   - `FRONTEND_GRAPH_SCHEMA.md` - Complete frontend schema specification
   - `backend_lambda/README.md` - Lambda deployment guide

### 🔄 In Progress

- **API Gateway Setup**: Need to create REST API and connect to Lambda
- **S3 Buckets**: Need to create buckets for frontend and cache
- **Environment Variables**: Need to configure Lambda env vars (`S3_BUCKET_NAME`, etc.)
- **GitHub Secrets**: Need to add AWS credentials and bucket names to repository

### ❌ Not Started

- CloudFront distribution for frontend
- Lambda@Edge for global caching
- EventBridge trigger for cache rebuilds
- Secret rotation mechanism
- Monitoring and alerting

---

## Where We Left Off

> ⚠️ **CURRENT STATUS - ACTION REQUIRED** ⚠️
>
> **Last completed task**: Created GitHub Actions deployment workflow (`.github/workflows/deploy.yml`)
>
> **Next immediate step**: **Create production Lambda function in AWS Console**
>
> ### What Needs to Happen Next:
>
> 1. **Deploy Lambda Function**
>    - Create Lambda function in AWS Console (Python 3.12)
>    - Upload `backend_lambda/lambda_function.py` code
>    - Set environment variables:
>      - `S3_BUCKET_NAME` = your cache bucket name
>      - `CACHE_KEY` = `graph_cache.json`
>    - Configure IAM role with S3 GetObject permission
>
> 2. **Create API Gateway**
>    - Create REST API in API Gateway
>    - Create resource: `/api/graph`
>    - Create method: `GET` → Integration: Lambda Function
>    - Enable CORS
>    - Deploy API (create stage: `prod`)
>    - Copy the API Gateway URL
>
> 3. **Update Production Environment**
>    - Update `.env.production` with actual API Gateway URL:
>      ```
>      VITE_API_URL=https://your-api-id.execute-api.us-west-2.amazonaws.com/prod
>      ```
>
> 4. **Build and Upload Cache**
>    - Run `python backend/tools/rebuild_graph_cache.py` locally
>    - Run `python tools/upload_cache.py` to upload to S3
>    - Verify Lambda can read cache from S3
>
> 5. **Configure GitHub Secrets**
>    - Add to repository secrets:
>      - `AWS_ACCESS_KEY_ID`
>      - `AWS_SECRET_ACCESS_KEY`
>      - `FRONTEND_BUCKET` (S3 bucket for frontend static files)
>      - `LAMBDA_NAME` (name of your Lambda function)
>
> 6. **Test Deployment**
>    - Push to `main` branch
>    - Verify GitHub Actions workflow runs successfully
>    - Test frontend at S3 bucket URL
>    - Verify Lambda serves graph data correctly

---

## Future Roadmap

### Short Term (1-2 weeks)

1. **Complete AWS Setup**
   - [ ] Deploy Lambda function to AWS
   - [ ] Create API Gateway endpoint
   - [ ] Create S3 buckets (frontend + cache)
   - [ ] Configure CloudFront distribution
   - [ ] Test end-to-end deployment

2. **CI/CD Pipeline**
   - [ ] Verify GitHub Actions workflow works
   - [ ] Add deployment notifications (Slack/email)
   - [ ] Set up staging environment
   - [ ] Add automated testing to pipeline

3. **Cache Automation**
   - [ ] Set up scheduled cache rebuilds (cron/systemd)
   - [ ] Add cache invalidation on DynamoDB updates
   - [ ] Monitor cache freshness

### Medium Term (1-2 months)

4. **Performance Optimization**
   - [ ] Lambda provisioned concurrency (reduce cold starts)
   - [ ] S3 Transfer Acceleration for cache uploads
   - [ ] CloudFront caching for API responses
   - [ ] Graph data compression (gzip)

5. **Monitoring & Observability**
   - [ ] CloudWatch dashboards (Lambda metrics, API Gateway)
   - [ ] Error alerting (SNS/Slack)
   - [ ] Cache hit rate monitoring
   - [ ] User analytics (frontend errors, load times)

6. **Security Hardening**
   - [ ] API Gateway API keys or OAuth
   - [ ] Lambda VPC configuration (if needed)
   - [ ] S3 bucket policies (least privilege)
   - [ ] Secret rotation mechanism

### Long Term (3+ months)

7. **Advanced Features**
   - [ ] Multi-region deployment
   - [ ] Lambda@Edge for global edge caching
   - [ ] GraphQL API (alternative to REST)
   - [ ] Real-time updates (WebSocket/Server-Sent Events)

8. **Infrastructure as Code**
   - [ ] Terraform/CloudFormation for AWS resources
   - [ ] Automated environment provisioning
   - [ ] Disaster recovery procedures

9. **Alternative Architectures**
   - [ ] S3 direct-loading option (bypass Lambda for graph data)
   - [ ] CloudFront Functions for simple transformations
   - [ ] Consider serverless framework migration

### S3 Direct-Loading Option (Future Enhancement)

**Idea**: Serve graph cache directly from S3 via CloudFront, bypassing Lambda entirely for the `/api/graph/data` endpoint.

**Benefits:**
- Zero compute cost (no Lambda invocations)
- Faster responses (CloudFront edge caching)
- Simpler architecture

**Implementation:**
1. Upload `graph_cache.json` to S3 with public-read ACL (or CloudFront OAC)
2. Configure CloudFront distribution for S3 bucket
3. Frontend fetches: `https://cdn.example.com/graph_cache.json`
4. CloudFront caches at edge locations globally

**Trade-offs:**
- Less control over error handling
- Cache must be public (or OAC with CloudFront)
- No request logging/authentication at S3 level

**When to Use:**
- Graph data is truly public
- Cost optimization is critical
- Global distribution is needed

---

## Key Files Reference

### Backend
- `backend/app.py` - Flask development server
- `backend/graph_core.py` - Pure graph building logic
- `backend/services/dynamodb_service.py` - Database layer with caching
- `backend/tools/rebuild_graph_cache.py` - Cache builder script
- `backend_lambda/lambda_function.py` - Production Lambda handler

### Frontend
- `src/services/dynamodb.ts` - Graph data fetching
- `src/components/ResearchNetworkGraph.tsx` - 3D graph visualization
- `.env` - Development API URL
- `.env.production` - Production API URL

### Deployment
- `.github/workflows/deploy.yml` - CI/CD pipeline
- `tools/upload_cache.py` - S3 cache upload script

### Documentation
- `FRONTEND_GRAPH_SCHEMA.md` - Complete frontend schema spec
- `docs/PROJECT_CONTEXT.md` - This file
- `backend_lambda/README.md` - Lambda deployment guide

---

## Quick Start Commands

### Development
```bash
# Start Flask backend
python backend/app.py

# Start frontend dev server
npm run dev

# Rebuild graph cache
python backend/tools/rebuild_graph_cache.py
```

### Production
```bash
# Build frontend
npm run build

# Upload cache to S3
export S3_BUCKET_NAME=your-bucket
python tools/upload_cache.py

# Deploy (via GitHub Actions on push to main)
git push origin main
```

---

**Document maintained by**: Development Team  
**Last major update**: November 2025  
**Next review**: After Lambda deployment completion

