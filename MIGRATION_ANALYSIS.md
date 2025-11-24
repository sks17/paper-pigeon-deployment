# Repository Migration Analysis
## Paper Pigeon → Vercel + Cloudflare Workers

**Analysis Date:** Current  
**Purpose:** Prepare codebase for migration from AWS Lambda/runtime infrastructure to Vercel + Cloudflare Workers  
**Critical Rule:** AWS as data source (DynamoDB, Bedrock, S3 reads) MUST remain intact. AWS deployment/runtime artifacts MUST be removed.

---

## 1. Directory Structure

```
paper-pigeon/
├── backend/                          # ✅ KEEP - Core Flask backend (data access)
│   ├── __init__.py                  # ✅ KEEP - Env loading
│   ├── app.py                       # ✅ KEEP - Flask app (main entry)
│   ├── build_graph_cache.py         # ✅ KEEP - Cache builder (uses DynamoDB)
│   ├── precompute_graph.py          # ✅ KEEP - Graph precomputation (uses DynamoDB + S3)
│   ├── graph_core.py                # ✅ KEEP - Pure graph building logic
│   ├── debug_test_env.py            # ⚠️ REVIEW - Debug script (logs env vars)
│   ├── debug_profile_graph.py       # ✅ KEEP - Profiling tool
│   ├── cache/                       # ✅ KEEP - Local cache storage
│   │   └── graph_cache.json         # ✅ KEEP - Cached graph data
│   ├── controllers/                 # ✅ KEEP - Flask blueprints
│   │   ├── __init__.py
│   │   ├── rag_controller.py        # ✅ KEEP - RAG endpoints (uses Bedrock)
│   │   ├── recommendations_controller.py  # ✅ KEEP - Recommendations (uses Bedrock)
│   │   └── pdf_controller.py         # ✅ KEEP - PDF URLs (uses S3)
│   ├── services/                    # ✅ KEEP - AWS data source services
│   │   ├── __init__.py              # ✅ KEEP - Env loading
│   │   ├── dynamodb_service.py       # ✅ KEEP - DynamoDB access (DATA SOURCE)
│   │   ├── bedrock_service.py       # ✅ KEEP - Bedrock RAG (DATA SOURCE)
│   │   └── s3_service.py             # ✅ KEEP - S3 presigned URLs (DATA SOURCE)
│   ├── tools/                       # ✅ KEEP - Utility scripts
│   │   ├── rebuild_graph_cache.py   # ✅ KEEP - Cache rebuild tool
│   │   └── logs/                    # ✅ KEEP - Log files
│   └── utils/                        # ✅ KEEP - Utilities
│       ├── __init__.py
│       ├── auth.py                   # ✅ KEEP - Auth utilities (empty)
│       └── cors.py                   # ✅ KEEP - CORS config
│
├── backend_lambda/                   # ❌ REMOVE - AWS Lambda deployment artifacts
│   ├── lambda_function.py           # ❌ REMOVE - Lambda handler
│   ├── requirements.txt             # ❌ REMOVE - Lambda dependencies
│   └── README.md                    # ❌ REMOVE - Lambda deployment docs
│
├── lambda_build_graph/               # ❌ REMOVE - Lambda build cache function
│   └── lambda_function.py           # ❌ REMOVE - Lambda handler
│
├── lambda_dist/                      # ❌ REMOVE - Lambda build output (empty)
│
├── build_lambda_zip.sh               # ❌ REMOVE - Lambda packaging script
│
├── tools/                            # ⚠️ REVIEW - S3 upload script
│   ├── upload_cache.py              # ⚠️ REVIEW - Uploads to S3 (may be needed for cache)
│   └── README.md
│
├── src/                              # ✅ KEEP - Frontend React app
│   ├── components/                   # ✅ KEEP - React components
│   ├── services/                     # ✅ KEEP - Frontend services
│   │   ├── dynamodb.ts              # ✅ KEEP - Backend API calls
│   │   └── pdf.ts                    # ✅ KEEP - PDF parsing
│   └── ...
│
├── venv/                             # ✅ KEEP - Python virtual environment
├── node_modules/                     # ✅ KEEP - Node dependencies
├── package.json                      # ✅ KEEP - Frontend dependencies
├── pnpm-lock.yaml                    # ✅ KEEP - Lock file
├── vite.config.ts                    # ✅ KEEP - Vite config
├── tsconfig*.json                    # ✅ KEEP - TypeScript configs
├── components.json                   # ✅ KEEP - UI components config
├── index.html                        # ✅ KEEP - HTML entry
├── README.md                         # ✅ KEEP - Documentation
├── SETUP.md                          # ✅ KEEP - Setup docs
├── CODEBASE_ANALYSIS.md              # ✅ KEEP - Analysis docs
├── FRONTEND_GRAPH_SCHEMA.md          # ✅ KEEP - Schema docs
└── docs/                             # ✅ KEEP - Documentation
    └── PROJECT_CONTEXT.md            # ✅ KEEP - Project context

```

---

## 2. Environment Variable References

### 2.1 Python Environment Variables (`os.getenv`, `os.environ`)

**Backend Services (DATA SOURCE - MUST PRESERVE):**
- `backend/services/dynamodb_service.py`:
  - `AWS_REGION` (line 18)
  - `AWS_ACCESS_KEY_ID` (line 6 - diagnostic print only)
- `backend/services/bedrock_service.py`:
  - `AWS_ACCESS_KEY_ID` (line 15)
  - `AWS_SECRET_ACCESS_KEY` (line 16)
  - `AWS_REGION` (line 17)
  - `VITE_BEDROCK_KNOWLEDGE_BASE_ID` (line 34)
  - `VITE_BEDROCK_DATA_SOURCE_ID` (line 35)
  - `VITE_BEDROCK_KNOWLEDGE_BASE_ID_2` (line 79)
- `backend/services/s3_service.py`:
  - `AWS_REGION` (line 21)
  - `S3_BUCKET_NAME` (line 24)

**Backend Scripts (UTILITY - KEEP):**
- `backend/precompute_graph.py`:
  - `S3_BUCKET_NAME` (line 44)
  - `AWS_REGION` (line 45)
- `backend/build_graph_cache.py`:
  - Uses `dotenv` to load `.env` file
- `backend/tools/rebuild_graph_cache.py`:
  - Uses `dotenv` to load `.env` file
- `backend/debug_test_env.py`:
  - `AWS_REGION` (line 19)
  - `AWS_ACCESS_KEY_ID` (line 20)
  - `AWS_SECRET_ACCESS_KEY` (line 21)

**Lambda Deployment Artifacts (REMOVE):**
- `backend_lambda/lambda_function.py`:
  - `S3_BUCKET_NAME` (line 40)
  - `CACHE_KEY` (line 41)
- `lambda_build_graph/lambda_function.py`:
  - `CACHE_BUCKET_NAME` (line 57)
  - `CACHE_OBJECT_KEY` (line 58)
- `tools/upload_cache.py`:
  - `S3_BUCKET_NAME` (line 23)
  - `CACHE_KEY` (line 24)
  - `AWS_REGION` (line 25)

### 2.2 Frontend Environment Variables (`import.meta.env`)

**Frontend Services:**
- `src/services/dynamodb.ts`:
  - `VITE_API_URL` (lines 3, 27)
- `src/components/PaperChatModal.tsx`:
  - `VITE_API_URL` (line 76)
- `src/components/ResearcherProfilePanel.tsx`:
  - `VITE_API_URL` (line 45)
- `src/components/ResearcherModal.tsx`:
  - `VITE_API_URL` (line 55)
- `src/components/ResearchNetworkGraph.tsx`:
  - `VITE_API_URL` (line 198)

### 2.3 Dotenv Usage

**Files using `load_dotenv()`:**
- `backend/__init__.py` (line 1, 3)
- `backend/services/__init__.py` (line 4, 12)
- `backend/build_graph_cache.py` (line 27, 28)
- `backend/tools/rebuild_graph_cache.py` (line 93, 96)
- `backend/debug_test_env.py` (line 4, 14)

**Expected `.env` file location:** `backend/.env` (not in repo, should be created)

**Required Environment Variables (from code analysis):**
```
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
VITE_BEDROCK_KNOWLEDGE_BASE_ID=
VITE_BEDROCK_DATA_SOURCE_ID=
VITE_BEDROCK_KNOWLEDGE_BASE_ID_2=
VITE_BEDROCK_DATA_SOURCE_ID_2=
S3_BUCKET_NAME=
VITE_API_URL=  # Frontend only
```

---

## 3. AWS Deployment Artifacts (MUST REMOVE)

### 3.1 Lambda Functions
- **`backend_lambda/lambda_function.py`** - Lambda handler for serving graph cache from S3
- **`backend_lambda/requirements.txt`** - Lambda dependencies
- **`backend_lambda/README.md`** - Lambda deployment documentation
- **`lambda_build_graph/lambda_function.py`** - Lambda handler for building/uploading cache
- **`lambda_dist/`** - Empty Lambda build output directory

### 3.2 Lambda Build/Packaging Scripts
- **`build_lambda_zip.sh`** - Bash script to package Lambda deployment ZIP

### 3.3 Lambda-Related Documentation
- References in `docs/PROJECT_CONTEXT.md` mentioning Lambda deployment
- References in `tools/README.md` mentioning Lambda deployment

### 3.4 S3 Upload Scripts (REVIEW)
- **`tools/upload_cache.py`** - Uploads cache to S3 for Lambda consumption
  - **Decision:** May be kept if cache needs to be uploaded to S3 for Cloudflare Workers to read
  - **Alternative:** Cache can be served directly from Vercel/Cloudflare Workers without S3

---

## 4. AWS Data Source Usage (MUST PRESERVE)

### 4.1 DynamoDB Service (`backend/services/dynamodb_service.py`)
**Status:** ✅ PRESERVE - Core data access layer

**Functions (all preserve):**
- `get_dynamodb()` - Lazy-loads DynamoDB resource
- `fetch_researchers()` - Scans `researchers` table
- `fetch_paper_edges()` - Scans `paper-edges` table
- `fetch_advisor_edges()` - Scans `advisor_edges` table
- `fetch_library_entries(researcher_id)` - Scans `library` table with filter
- `fetch_papers(document_ids)` - Batch-get from `papers` table
- `fetch_lab_info(lab_ids)` - Batch-get from `lab-info` table
- `fetch_descriptions(researcher_ids)` - Batch-get from `descriptions` table
- `fetch_metrics(researcher_ids)` - Batch-get from `metrics` table
- `_batch_get()` - Helper for batch-get operations (handles 100-key limit)

**Tables Accessed:**
- `researchers`
- `paper-edges`
- `advisor_edges`
- `library`
- `papers`
- `lab-info`
- `descriptions`
- `metrics`

### 4.2 Bedrock Service (`backend/services/bedrock_service.py`)
**Status:** ✅ PRESERVE - RAG inference service

**Functions:**
- `_get_bedrock_client()` - Lazy-loads Bedrock client
- `rag_chat(query, document_id)` - RAG chat using Knowledge Base 1
- `rag_recommend(resume_text)` - Resume-based recommendations using Knowledge Base 2

**Knowledge Bases:**
- `VITE_BEDROCK_KNOWLEDGE_BASE_ID` - For document-specific RAG chat
- `VITE_BEDROCK_KNOWLEDGE_BASE_ID_2` - For resume recommendations

### 4.3 S3 Service (`backend/services/s3_service.py`)
**Status:** ✅ PRESERVE - PDF presigned URL generation

**Functions:**
- `get_presigned_pdf_url(lab_id, document_id)` - Generates presigned URLs for PDFs

**S3 Structure:**
- Bucket: `S3_BUCKET_NAME` env var
- Key pattern: `{lab_id}/{document_id}.pdf`
- Expiration: 3600 seconds (1 hour)

### 4.4 Graph Building (`backend/graph_core.py`)
**Status:** ✅ PRESERVE - Pure graph construction logic

**Function:**
- `build_graph_data_pure()` - Builds graph from DynamoDB data

**Dependencies:**
- Uses all DynamoDB service functions
- No Flask dependencies (pure Python)

### 4.5 Cache Building Scripts
**Status:** ✅ PRESERVE - Utility scripts for cache management

- `backend/build_graph_cache.py` - Builds cache locally
- `backend/tools/rebuild_graph_cache.py` - Standalone rebuild script with logging
- `backend/precompute_graph.py` - Precomputes and uploads to S3 (may need modification)

---

## 5. Secret Logging Issues (UNSAFE - MARK FOR REVIEW)

### 5.1 Critical Issues

**`backend/services/dynamodb_service.py` (lines 5-6):**
```python
# Diagnostic: Print environment variables before any boto3 operations
print("ENV BEFORE DYNAMODB:", {k: os.getenv(k) for k in ["AWS_REGION", "AWS_ACCESS_KEY_ID"]})
```
**Risk:** ⚠️ **HIGH** - Logs `AWS_ACCESS_KEY_ID` (partial secret exposure)  
**Action:** Remove or mask this diagnostic print before production

**`backend/services/dynamodb_service.py` (line 19):**
```python
print("AWS_REGION detected:", aws_region)
```
**Risk:** ⚠️ **LOW** - Logs region (not sensitive, but noisy)

**`backend/debug_test_env.py` (line 24):**
```python
print(f"AWS_ACCESS_KEY_ID: {'SET' if aws_access_key else 'NOT SET'} ({'***' + aws_access_key[-4:] if aws_access_key and len(aws_access_key) > 4 else 'N/A'})")
```
**Risk:** ⚠️ **MEDIUM** - Logs last 4 chars of access key (debug script, but should not run in production)

**`backend/debug_test_env.py` (line 25):**
```python
print(f"AWS_SECRET_ACCESS_KEY: {'SET' if aws_secret_key else 'NOT SET'}")
```
**Risk:** ⚠️ **LOW** - Only indicates presence, not value

### 5.2 Recommendations
1. Remove or comment out diagnostic prints in `dynamodb_service.py`
2. Ensure `debug_test_env.py` is not included in production builds
3. Add environment-based logging levels (only log secrets in development)
4. Consider using structured logging that can filter sensitive fields

---

## 6. Active Backend Endpoints

### 6.1 Flask App (`backend/app.py`)

**Endpoints:**
- `GET /health` - Health check
- `GET /api/graph/data` - Returns cached graph data (no DynamoDB call)
- `POST /api/graph/rebuild-cache` - Rebuilds cache from DynamoDB
- `POST /api/graph/paper-lab-id` - Gets lab_id for a paper (uses DynamoDB)

### 6.2 RAG Controller (`backend/controllers/rag_controller.py`)
- `GET /api/rag/test` - Test endpoint
- `POST /api/rag/chat` - RAG chat (uses Bedrock)

### 6.3 Recommendations Controller (`backend/controllers/recommendations_controller.py`)
- `GET /api/recommendations/test` - Test endpoint
- `POST /api/recommendations/from-resume` - Resume recommendations (uses Bedrock)

### 6.4 PDF Controller (`backend/controllers/pdf_controller.py`)
- `GET /api/pdf/test` - Test endpoint
- `POST /api/pdf/url` - Generate presigned PDF URL (uses S3)

**All endpoints use AWS as data source and MUST be preserved.**

---

## 7. Repository State Summary

### 7.1 Backend Modules (MUST STAY)

**Core Flask Application:**
- `backend/app.py` - Main Flask app with cache-first architecture
- `backend/controllers/` - All controllers (RAG, recommendations, PDF)
- `backend/utils/` - CORS and auth utilities

**AWS Data Source Services:**
- `backend/services/dynamodb_service.py` - DynamoDB access (8 tables)
- `backend/services/bedrock_service.py` - Bedrock RAG (2 knowledge bases)
- `backend/services/s3_service.py` - S3 presigned URLs

**Graph Building:**
- `backend/graph_core.py` - Pure graph construction
- `backend/build_graph_cache.py` - Local cache builder
- `backend/tools/rebuild_graph_cache.py` - Standalone rebuild tool
- `backend/precompute_graph.py` - S3 upload script (may need modification)

**Cache Storage:**
- `backend/cache/graph_cache.json` - Pre-built graph cache

### 7.2 Deployment Modules (MUST REMOVE)

**Lambda Functions:**
- `backend_lambda/` - Entire directory
- `lambda_build_graph/` - Entire directory
- `lambda_dist/` - Empty build directory

**Build Scripts:**
- `build_lambda_zip.sh` - Lambda packaging

**Documentation:**
- Lambda deployment references in `docs/PROJECT_CONTEXT.md`
- Lambda deployment references in `tools/README.md`

### 7.3 Environment Variable Locations

**Backend (Python):**
- `.env` file expected at: `backend/.env` (not in repo)
- Loaded via: `backend/__init__.py`, `backend/services/__init__.py`
- Used in: All service files, build scripts

**Frontend (TypeScript):**
- `VITE_API_URL` - Used in all API calls
- Must be set in Vercel environment variables

### 7.4 Files Requiring Cleanup

**Before Migration:**
1. Remove diagnostic prints in `backend/services/dynamodb_service.py` (lines 5-6, 19)
2. Remove or quarantine `backend/debug_test_env.py` (contains secret logging)
3. Remove Lambda artifacts (see section 3)
4. Update `tools/upload_cache.py` if cache strategy changes
5. Review `backend/precompute_graph.py` if S3 upload is no longer needed

**Frontend Dependencies:**
- `package.json` contains AWS SDK dependencies that are no longer used:
  - `@aws-sdk/client-bedrock-agent-runtime`
  - `@aws-sdk/client-dynamodb`
  - `@aws-sdk/client-s3`
  - `@aws-sdk/lib-dynamodb`
  - `@aws-sdk/s3-request-presigner`
  - `@aws-sdk/util-dynamodb`
  
  **Action:** These can be removed from `package.json` as frontend now uses `fetch()` to call backend APIs.

---

## 8. READY-FOR-MIGRATION SUMMARY

### 8.1 What Stays (AWS Data-Fetching Functions)

**✅ All Backend Services:**
- `backend/services/dynamodb_service.py` - DynamoDB access (8 tables, all functions)
- `backend/services/bedrock_service.py` - Bedrock RAG (2 knowledge bases)
- `backend/services/s3_service.py` - S3 presigned URLs

**✅ All Backend Controllers:**
- `backend/controllers/rag_controller.py` - RAG chat endpoint
- `backend/controllers/recommendations_controller.py` - Resume recommendations
- `backend/controllers/pdf_controller.py` - PDF URL generation

**✅ Graph Building Logic:**
- `backend/graph_core.py` - Pure graph construction
- `backend/build_graph_cache.py` - Cache builder
- `backend/tools/rebuild_graph_cache.py` - Rebuild tool

**✅ Flask Application:**
- `backend/app.py` - Main Flask app with all endpoints
- `backend/utils/cors.py` - CORS configuration

**✅ Frontend:**
- All React components
- All frontend services (now using `fetch()` to backend)
- All UI components

### 8.2 What Goes (AWS Runtime Infrastructure)

**❌ Lambda Functions:**
- `backend_lambda/` - Entire directory
- `lambda_build_graph/` - Entire directory
- `lambda_dist/` - Build output directory

**❌ Lambda Build Scripts:**
- `build_lambda_zip.sh` - Packaging script

**❌ Lambda Documentation:**
- Lambda deployment sections in docs

**❌ Frontend AWS SDK Dependencies:**
- All `@aws-sdk/*` packages in `package.json` (no longer needed)

### 8.3 What Needs Addressing Before New Deployment Pipeline

**1. Secret Logging Cleanup:**
   - Remove diagnostic prints in `backend/services/dynamodb_service.py`
   - Quarantine or remove `backend/debug_test_env.py`
   - Add environment-based logging levels

**2. Environment Variable Migration:**
   - Move `backend/.env` to Vercel environment variables (backend)
   - Set `VITE_API_URL` in Vercel environment variables (frontend)
   - Ensure Cloudflare Workers can access AWS credentials (if used)

**3. Cache Strategy:**
   - Decide if `backend/cache/graph_cache.json` should be:
     - Served from Vercel/Cloudflare Workers directly
     - Uploaded to S3 and read by Workers
     - Built on-demand
   - Update `backend/precompute_graph.py` if S3 upload is no longer needed
   - Update `tools/upload_cache.py` if cache strategy changes

**4. Flask App Adaptation:**
   - Ensure Flask app can run on Vercel serverless functions
   - May need to wrap Flask app in Vercel-compatible handler
   - Update CORS configuration for new frontend URL

**5. Frontend Dependencies:**
   - Remove unused AWS SDK packages from `package.json`
   - Run `pnpm install` to update lock file

**6. Build Scripts:**
   - Remove `build_lambda_zip.sh`
   - Update any CI/CD workflows that reference Lambda deployment

**7. Documentation:**
   - Update deployment documentation to reflect Vercel + Cloudflare Workers
   - Remove Lambda deployment instructions
   - Add Vercel deployment instructions

**8. Testing:**
   - Test all endpoints after migration
   - Verify AWS credentials work in new environment
   - Test cache rebuild functionality
   - Test RAG endpoints
   - Test PDF URL generation

---

## 9. Migration Checklist

### Pre-Migration
- [ ] Remove diagnostic prints from `dynamodb_service.py`
- [ ] Quarantine `debug_test_env.py`
- [ ] Remove Lambda artifacts (`backend_lambda/`, `lambda_build_graph/`, `lambda_dist/`, `build_lambda_zip.sh`)
- [ ] Remove AWS SDK dependencies from `package.json`
- [ ] Update documentation to remove Lambda references

### Migration
- [ ] Set up Vercel project
- [ ] Configure environment variables in Vercel
- [ ] Deploy Flask app to Vercel serverless functions
- [ ] Deploy frontend to Vercel
- [ ] Set up Cloudflare Workers (if needed)
- [ ] Test all endpoints
- [ ] Verify AWS data access works

### Post-Migration
- [ ] Update cache strategy if needed
- [ ] Set up cache rebuild automation
- [ ] Monitor logs for secret leaks
- [ ] Update CI/CD pipelines
- [ ] Update documentation

---

**End of Analysis**

