# Paper Pigeon - Full System Diagnostics Report

**Generated**: Current  
**Scope**: Frontend, Backend, Routing, File Serving, Vercel Runtime

---

## A. FRONTEND → BACKEND CALL MAP

### All `fetch()` Calls in Frontend

| Location | Code | Expected URL | Vercel Rewrite Target | Potential Issue |
|----------|------|--------------|----------------------|-----------------|
| `src/services/dynamodb.ts:50` | `${VITE_API_URL}/api/graph/data` | `https://<domain>/api/graph/data` | `/api/index.py` → Flask `/api/graph/data` | ⚠️ If `VITE_API_URL` is empty string, becomes `/api/graph/data` (OK). If undefined, becomes `undefined/api/graph/data` (FAIL). |
| `src/services/dynamodb.ts:74` | `${VITE_API_URL}/api/graph/paper-lab-id` | `https://<domain>/api/graph/paper-lab-id` | `/api/index.py` → Flask `/api/graph/paper-lab-id` | Same as above |
| `src/components/PaperChatModal.tsx:76` | `${VITE_API_URL}/api/rag/chat` | `https://<domain>/api/rag/chat` | `/api/index.py` → Flask `/api/rag/chat` | Same as above |
| `src/components/ResearcherModal.tsx:55` | `${VITE_API_URL}/api/pdf/url` | `https://<domain>/api/pdf/url` | `/api/index.py` → Flask `/api/pdf/url` | Same as above |
| `src/components/ResearchNetworkGraph.tsx:199` | `${VITE_API_URL}/api/recommendations/from-resume` | `https://<domain>/api/recommendations/from-resume` | `/api/index.py` → Flask `/api/recommendations/from-resume` | Same as above |

### Double `/api/api/` Path Analysis

**Root Cause Check:**

- Flask app registers blueprints WITH `/api/*` prefix:
  ```python
  # backend/app.py:80-82
  app.register_blueprint(rag_bp, url_prefix='/api/rag')
  app.register_blueprint(recommendations_bp, url_prefix='/api/recommendations')
  app.register_blueprint(pdf_bp, url_prefix='/api/pdf')
  ```

- Vercel rewrites `/api/(.*)` → `/api/index.py`
- Flask routes are `/api/rag/chat`, `/api/graph/data`, etc.

**Verdict**: ✅ No `/api/api/` duplication in current config. Flask routes include the full `/api/` prefix, and Vercel just routes to the handler. Paths are correct.

### VITE_API_URL Risk Analysis

**Critical Issue**: If `VITE_API_URL` is not set in Vercel build environment:

```javascript
const url = `${import.meta.env.VITE_API_URL}/api/graph/data`;
// If VITE_API_URL is undefined:
// url = "undefined/api/graph/data"  ❌ FAILS
```

**Production scenarios:**

| VITE_API_URL Value | Resulting URL | Works? |
|-------------------|---------------|--------|
| `https://paper-pigeon.vercel.app` | `https://paper-pigeon.vercel.app/api/graph/data` | ✅ |
| `` (empty string) | `/api/graph/data` | ✅ (relative) |
| `undefined` | `undefined/api/graph/data` | ❌ FAILS |
| Not set at build time | `undefined/api/graph/data` | ❌ FAILS |

---

## B. VERCEL ROUTING + PYTHON HANDLER VALIDATION

### Handler Export Analysis

**File: `api/index.py`**
```python
from backend_wrapper import app
```

**File: `backend_wrapper.py`**
```python
from backend.app import app
```

**Vercel Python Runtime Requirements:**
- Vercel looks for `app` or `application` in the handler file
- Current export: `app` ✅

**CRITICAL ISSUE**: The import is just `app`, but Vercel Python runtime typically expects `application` for WSGI or needs specific configuration.

**Verification needed**: Does Vercel auto-detect Flask `app` objects? According to Vercel docs, for Python Flask:
- Export should be `app` (Flask instance) ✅
- File should be in `api/` directory ✅

### Routing Chain

```
Browser Request: GET /api/graph/data
    ↓
vercel.json rewrite: /api/(.*) → /api/index.py
    ↓
api/index.py: imports backend_wrapper.app
    ↓
backend_wrapper.py: imports backend.app.app (Flask instance)
    ↓
Flask routing: @app.route('/api/graph/data')
    ↓
Response
```

**Potential Issues:**

1. **Module resolution in Vercel**: 
   - `backend_wrapper.py` imports `from backend.app import app`
   - This requires `backend/` to be a valid Python package
   - Check: `backend/__init__.py` exists ✅

2. **dynamodb_service.py import-time execution (Line 6)**:
   ```python
   print("ENV BEFORE DYNAMODB:", {k: os.getenv(k) for k in ["AWS_REGION", "AWS_ACCESS_KEY_ID"]})
   ```
   - **SECURITY RISK**: Prints AWS credentials to logs
   - **PERFORMANCE**: Executes on every cold start

---

## C. STATIC FILE / ASSET DELIVERY

### Asset Location Mapping

| Asset | Source Location | Build Output | HTML Reference | Status |
|-------|-----------------|--------------|----------------|--------|
| Favicon | `public/favicon.png` | `dist/favicon.png` | `/favicon.png` | ✅ |
| Graph Cache | `public/graph_cache.json` | `dist/graph_cache.json` | N/A (API serves) | ✅ |
| React SVG | `public/react.svg` | `dist/react.svg` | N/A | ✅ |

### Problematic Assets

| Asset | Location | Issue |
|-------|----------|-------|
| `src/assets/favicon.jpeg` | `src/assets/` | ⚠️ JPEG file exists but HTML uses `/favicon.png` from `public/` |
| `src/assets/react.svg` | `src/assets/` | Duplicate of `public/react.svg` |

### index.html Asset References

**Source (`index.html`):**
```html
<link rel="icon" type="image/png" href="/favicon.png" />
```

**Build Output (`dist/index.html`):**
```html
<link rel="icon" type="image/png" href="/favicon.png" />
<script type="module" crossorigin src="/assets/index-CIAD-txM.js"></script>
<link rel="stylesheet" crossorigin href="/assets/index-CguqoYb-.css">
```

### Build Output Verification

**`dist/` contents:**
```
dist/
├── assets/
│   ├── index-CguqoYb-.css    ✅
│   ├── index-CIAD-txM.js     ✅
│   └── pdf.worker.min-yatZIOMy.mjs  ✅
├── favicon.png               ✅ (copied from public/)
├── graph_cache.json          ✅ (copied from public/)
├── index.html                ✅
└── react.svg                 ✅
```

### Potential 404s

| Requested Path | Expected Location | Exists? |
|----------------|-------------------|---------|
| `/favicon.png` | `dist/favicon.png` | ✅ |
| `/favicon.jpeg` | `dist/favicon.jpeg` | ❌ NOT FOUND |
| `/src/assets/favicon.jpeg` | N/A | ❌ Dev path, not served |
| `/assets/index-*.js` | `dist/assets/` | ✅ |
| `/graph_cache.json` | `dist/graph_cache.json` | ✅ |

---

## D. GRAPH LOADING ENDPOINT

### Endpoint: `GET /api/graph/data`

**Location**: `backend/app.py:85-95`

```python
@app.route('/api/graph/data', methods=['GET'])
def get_graph_data():
    global _graph_cache
    if _graph_cache is None:
        load_graph_cache()
    return jsonify(_graph_cache)
```

### Cache Loading Logic (`load_graph_cache()`)

**File**: `backend/app.py:23-60`

**Priority Order:**
1. `backend/cache/graph_cache.json` 
2. `public/graph_cache.json` (fallback)
3. Empty `{"nodes": [], "links": []}` (final fallback)

### Path Resolution in Vercel

```python
backend_dir = os.path.dirname(os.path.abspath(__file__))
cache_path = os.path.join(backend_dir, "cache", "graph_cache.json")
```

**Vercel filesystem structure:**
```
/var/task/
├── api/
│   └── index.py
├── backend/
│   ├── app.py
│   ├── cache/
│   │   └── graph_cache.json  ← May or may not be included
│   └── ...
├── public/
│   └── graph_cache.json      ← Should be copied to output
└── dist/
    └── graph_cache.json      ← Frontend static
```

**CRITICAL ISSUE**: The fallback path resolution:
```python
public_path = os.path.join(os.path.dirname(__file__), "..", "public", "graph_cache.json")
```

In Vercel, `os.path.dirname(__file__)` for `backend/app.py` is `/var/task/backend/`.
So `public_path` becomes `/var/task/public/graph_cache.json`.

**Does `public/` exist at runtime in Vercel?**
- Vite copies `public/` contents to `dist/` during build
- But `public/` folder itself may not be deployed to serverless function
- **FIX NEEDED**: Backend should read from `dist/graph_cache.json` not `public/`

### Double-Prefix Check

Frontend calls:
```javascript
const url = `${import.meta.env.VITE_API_URL}/api/graph/data`;
```

If `VITE_API_URL = "https://example.vercel.app"`:
- URL = `https://example.vercel.app/api/graph/data` ✅

No `/api/api/` issue here.

---

## E. RAG ENDPOINT FAILURE CHAIN

### Full Call Path

```
Frontend: PaperChatModal.tsx:76
    ↓
POST /api/rag/chat
Body: { "query": "...", "document_id": "..." }
    ↓
Vercel rewrite → api/index.py
    ↓
Flask routing → rag_controller.chat()
    ↓
bedrock_service.rag_chat(query, document_id)
    ↓
boto3.client("bedrock-agent-runtime")
    ↓
client.retrieve_and_generate()
    ↓
Response
```

### Failure Points (Ordered)

#### 1. Environment Variable Resolution (`bedrock_service.py:34-36`)

```python
aws_access_key = _env("AWS_ACCESS_KEY_ID", "VITE_AWS_ACCESS_KEY_ID")
aws_secret_key = _env("AWS_SECRET_ACCESS_KEY", "VITE_AWS_SECRET_ACCESS_KEY")
aws_region = _env("AWS_REGION", "VITE_AWS_REGION")
```

**If none are set**: `aws_access_key = None`, boto3 client fails or uses instance metadata.

#### 2. Bedrock Client Creation (`bedrock_service.py:47-53`)

```python
client = boto3.client(
    "bedrock-agent-runtime",
    aws_access_key_id=aws_access_key,      # Could be None
    aws_secret_access_key=aws_secret_key,  # Could be None
    region_name=aws_region                  # Could be None
)
```

**Failure modes:**
- If credentials are `None`: boto3 uses default credential chain
- If region is `None`: `NoRegionError`
- If invalid credentials: `ClientError` on first API call

#### 3. Knowledge Base ID Resolution (`bedrock_service.py:115-116`)

```python
knowledge_base_id = _env("BEDROCK_KNOWLEDGE_BASE_ID", "VITE_BEDROCK_KNOWLEDGE_BASE_ID")
data_source_id = _env("BEDROCK_DATA_SOURCE_ID", "VITE_BEDROCK_DATA_SOURCE_ID")
```

**If not set**: Explicit `ValueError` raised at lines 125-135.

#### 4. Bedrock API Call (`bedrock_service.py:174`)

```python
response = client.retrieve_and_generate(**request_payload)
```

**Failure modes:**
- `AccessDeniedException`: IAM permissions
- `ValidationException`: Invalid knowledge base ID
- `ResourceNotFoundException`: Knowledge base doesn't exist
- Timeout: API taking too long

#### 5. Exception Handling in Controller (`rag_controller.py:65-83`)

Currently catches all exceptions and returns 500 with error details.

---

## F. ENVIRONMENT VARIABLE ALIGNMENT AUDIT

### Backend Expected Variables

| Variable | Used In | Current os.getenv() | _env() Fallback |
|----------|---------|---------------------|-----------------|
| `AWS_ACCESS_KEY_ID` | `bedrock_service.py:34` | ✅ | `VITE_AWS_ACCESS_KEY_ID` |
| `AWS_SECRET_ACCESS_KEY` | `bedrock_service.py:35` | ✅ | `VITE_AWS_SECRET_ACCESS_KEY` |
| `AWS_REGION` | `bedrock_service.py:36`, `s3_service.py:21`, `dynamodb_service.py:18` | ✅ | `VITE_AWS_REGION` |
| `BEDROCK_KNOWLEDGE_BASE_ID` | `bedrock_service.py:115` | ✅ | `VITE_BEDROCK_KNOWLEDGE_BASE_ID` |
| `BEDROCK_DATA_SOURCE_ID` | `bedrock_service.py:116` | ✅ | `VITE_BEDROCK_DATA_SOURCE_ID` |
| `BEDROCK_KNOWLEDGE_BASE_ID_2` | `bedrock_service.py:259` | ✅ | `VITE_BEDROCK_KNOWLEDGE_BASE_ID_2` |
| `S3_BUCKET_NAME` | `s3_service.py:24` | ❌ No fallback | - |

### Frontend Expected Variables

| Variable | Used In | Required |
|----------|---------|----------|
| `VITE_API_URL` | All fetch() calls | ✅ Critical |

### README.md Instructions (Lines 40-47)

```
- VITE_AWS_REGION
- VITE_AWS_ACCESS_KEY_ID
- VITE_AWS_SECRET_ACCESS_KEY
- VITE_BEDROCK_MODEL_ID
- VITE_BEDROCK_KNOWLEDGE_BASE_ID
- VITE_BEDROCK_DATA_SOURCE_ID
- VITE_BEDROCK_KNOWLEDGE_BASE_ID_2
- VITE_BEDROCK_DATA_SOURCE_ID_2
```

### Mismatch Summary

| Issue | Impact |
|-------|--------|
| README uses `VITE_` prefix for backend vars | Confusing; backend now accepts both |
| `S3_BUCKET_NAME` has no `VITE_` fallback | Will fail if only `VITE_S3_BUCKET_NAME` is set |
| `dynamodb_service.py` uses only `AWS_REGION` | No fallback to `VITE_AWS_REGION` |
| `s3_service.py` uses only `AWS_REGION` | No fallback to `VITE_AWS_REGION` |

### Missing Fallbacks to Add

| File | Line | Current | Should Add |
|------|------|---------|------------|
| `s3_service.py` | 21 | `os.getenv("AWS_REGION")` | `_env("AWS_REGION", "VITE_AWS_REGION")` |
| `s3_service.py` | 24 | `os.getenv("S3_BUCKET_NAME")` | `_env("S3_BUCKET_NAME", "VITE_S3_BUCKET_NAME")` |
| `dynamodb_service.py` | 18 | `os.getenv("AWS_REGION")` | `_env("AWS_REGION", "VITE_AWS_REGION")` |

---

## G. BUILD INTEGRITY ANALYSIS

### package.json vs pnpm-lock.yaml

**Key Dependencies:**

| Package | package.json | Status |
|---------|--------------|--------|
| `3d-force-graph` | `^1.79.0` | ✅ |
| `react` | `^19.1.1` | ✅ |
| `pdfjs-dist` | `^4.8.69` | ✅ |
| `three` | `^0.180.0` | ✅ |
| `boto3` | N/A (Python) | N/A |

### Removed Dependencies (VR)

Based on analysis, these were removed:
- `3d-force-graph-vr` - ✅ Not in package.json
- `react-router-dom` - ✅ Not in package.json

### Build Output Verification

| Expected File | Exists in dist/ |
|---------------|-----------------|
| `index.html` | ✅ |
| `assets/index-*.js` | ✅ |
| `assets/index-*.css` | ✅ |
| `favicon.png` | ✅ |
| `graph_cache.json` | ✅ |
| `assets/pdf.worker.min-*.mjs` | ✅ |

### requirements.txt (Python)

```
flask
flask-cors
boto3
python-dotenv
```

**Note**: `python-dotenv` is listed but `.env` loading was removed from `backend/__init__.py`. This is fine - dotenv is optional now.

---

## H. GLOBAL FAILURE SUMMARY

### Root Causes Found

| # | Category | File | Line(s) | Issue | Impact | Fix |
|---|----------|------|---------|-------|--------|-----|
| 1 | **Env Var** | `s3_service.py` | 21, 24 | No `VITE_` fallback for `AWS_REGION`, `S3_BUCKET_NAME` | PDF URL generation fails | Add `_env()` helper |
| 2 | **Env Var** | `dynamodb_service.py` | 18 | No `VITE_` fallback for `AWS_REGION` | DynamoDB fails | Add `_env()` helper |
| 3 | **Security** | `dynamodb_service.py` | 6 | Prints AWS env vars at import time | Credential leak in logs | Remove print statement |
| 4 | **Path** | `backend/app.py` | 43 | Fallback path `../public/` may not exist in Vercel | Graph cache 404 | Use `dist/` or static URL |
| 5 | **CORS** | `backend/app.py` | 17 | Only allows `localhost:5173` | Production CORS blocked | Add production origins |
| 6 | **Frontend** | All `fetch()` calls | - | If `VITE_API_URL` is undefined, URLs break | API calls fail | Enforce at build time or use relative |

### Priority Order

1. **CRITICAL**: CORS blocking production (app.py:17)
2. **CRITICAL**: `VITE_API_URL` undefined check
3. **HIGH**: s3_service.py missing env fallbacks
4. **HIGH**: dynamodb_service.py missing env fallbacks
5. **MEDIUM**: Security - remove env var printing
6. **LOW**: Graph cache path fallback

---

## TEMPORARY DIAGNOSTIC LOGGING (Preview)

See diff preview below for all temporary logging to be added.

---

## NEXT STEPS

1. Review and approve the diff preview below
2. Deploy to Vercel
3. Check Vercel function logs for `[DIAG]` messages
4. Identify which failure point is hit
5. Apply targeted fix


