# Step 2 — Backend Vercel Ingestion Report

## 1. Backend Entry File Identification

**Entry File**: `backend/app.py`

**Location**: `backend/app.py` (not in `api/` directory)

**Flask App Exposure**: 
- Flask app is created as `app = Flask(__name__)` at module level (line 23)
- App is exposed at top level, not inside a function
- **Status**: ✅ Flask app is properly exposed for Vercel detection

---

## 2. Vercel Python Function Structure Compliance

### Current Structure
```
backend/
├── app.py                    # Flask app entry point
├── __init__.py               # Package init (loads .env)
├── controllers/              # Blueprint modules
├── services/                 # AWS service wrappers
└── graph_core.py            # Graph builder
```

### Vercel Requirements Check

**Requirement 1**: Entry file in `api/` directory
- **Status**: ❌ **NON-COMPLIANT**
- **Current**: Backend is in `backend/` directory
- **Vercel Expects**: `api/index.py` or `api/<route>.py` by default
- **Impact**: Vercel will not automatically detect backend as serverless function

**Requirement 2**: Flask app exposed at module level
- **Status**: ✅ **COMPLIANT**
- **Current**: `app = Flask(__name__)` at module level in `backend/app.py`
- **Vercel Behavior**: Can auto-detect Flask apps when `app` is exposed

**Requirement 3**: Handler function (for non-Flask)
- **Status**: N/A (Flask app detected)
- **Note**: Not required since Flask app is present

---

## 3. Import Graph Verification

### Import Structure Analysis

**`backend/app.py` imports**:
1. `import backend` (triggers `backend/__init__.py`)
2. `from backend.controllers.rag_controller import rag_bp` ✅ (absolute import)
3. `from backend.controllers.recommendations_controller import recommendations_bp` ✅ (absolute import)
4. `from backend.controllers.pdf_controller import pdf_bp` ✅ (absolute import)
5. `from backend.graph_core import build_graph_data_pure` (lazy import, line 102) ✅

**`backend/controllers/*.py` imports**:
- `rag_controller.py`: `from services.bedrock_service import rag_chat` ❌ (relative import)
- `pdf_controller.py`: `from services.s3_service import get_presigned_pdf_url` ❌ (relative import)
- `recommendations_controller.py`: `from services.bedrock_service import rag_recommend` ❌ (relative import)

**`backend/graph_core.py` imports**:
- `from services.dynamodb_service import ...` ❌ (relative import)

### Import Path Dependencies

**Critical Path Manipulation** (`backend/app.py` lines 9-12):
```python
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)
```

**Purpose**: Adds project root to `sys.path` to enable relative imports in controllers/services

**Dependency Chain**:
1. `backend/app.py` manipulates `sys.path` → enables relative imports
2. Controllers use `from services.*` (relative) → depends on `sys.path` manipulation
3. `graph_core.py` uses `from services.*` (relative) → depends on `sys.path` manipulation

**Status**: ⚠️ **FRAGILE** - Relative imports depend on runtime `sys.path` manipulation

---

## 4. Vercel Flask App Detection

### Auto-Detection Capability

**Flask App Detection**: ✅ **DETECTABLE**
- `app = Flask(__name__)` is at module level
- Vercel can auto-detect Flask apps when `app` variable is present

**Detection Obstacle**: ❌ **DIRECTORY STRUCTURE**
- Vercel looks for `api/` directory by default
- Backend is in `backend/` directory
- **Impact**: Vercel will not automatically discover `backend/app.py` without configuration

**Configuration Required**: 
- `vercel.json` configuration file needed to map `backend/app.py` to API routes
- OR backend must be moved/aliased to `api/` directory structure

---

## 5. Obstacles Preventing Vercel Recognition

### Critical Obstacles

**1. Directory Structure Mismatch**
- **Issue**: Backend in `backend/` directory, not `api/`
- **Location**: Entire `backend/` directory structure
- **Impact**: Vercel will not automatically detect backend as serverless function
- **Vercel Behavior**: Looks for `api/` directory by default

**2. Missing Vercel Configuration**
- **Issue**: No `vercel.json` file found in repository
- **Location**: Repository root
- **Impact**: Cannot configure custom backend location or routing
- **Required**: Configuration to map `backend/app.py` to API routes

**3. Relative Import Dependencies**
- **Issue**: Controllers and `graph_core.py` use relative imports (`from services.*`)
- **Location**: 
  - `backend/controllers/rag_controller.py:2`
  - `backend/controllers/pdf_controller.py:2`
  - `backend/controllers/recommendations_controller.py:2`
  - `backend/graph_core.py:6`
- **Dependency**: Requires `sys.path` manipulation in `backend/app.py` (lines 9-12)
- **Impact**: May fail in Vercel's serverless environment if `sys.path` manipulation doesn't work as expected
- **Risk**: Import errors if Vercel's Python runtime doesn't preserve `sys.path` state

**4. Missing Python Dependencies File**
- **Issue**: No `requirements.txt` found in repository
- **Location**: Repository root or `backend/` directory
- **Impact**: Vercel cannot install Python dependencies
- **Required Packages** (inferred from imports):
  - `flask`
  - `flask-cors`
  - `boto3`
  - `python-dotenv`

### Medium Priority Obstacles

**5. Environment Variable Loading**
- **Issue**: `backend/__init__.py` loads `.env` file from `backend/.env`
- **Location**: `backend/__init__.py:3`
- **Impact**: Will attempt to load `.env` file (silent if missing)
- **Vercel Behavior**: Should use environment variables from Vercel dashboard instead

**6. File System Dependencies**
- **Issue**: `load_graph_cache()` reads from `backend/cache/graph_cache.json`
- **Location**: `backend/app.py:32-55`
- **Impact**: File may not be accessible in Vercel serverless (read-only filesystem)
- **Current Behavior**: Falls back to empty graph if file missing

**7. Startup Code Execution**
- **Issue**: `load_graph_cache()` called at module level (line 75)
- **Location**: `backend/app.py:75`
- **Impact**: Executes on every cold start (may be slow)
- **Vercel Behavior**: Serverless functions execute startup code on each invocation

---

## Summary

**Vercel Detection Status**: ❌ **NOT AUTOMATICALLY DETECTABLE**

**Primary Blockers**:
1. Backend in `backend/` directory (not `api/`)
2. No `vercel.json` configuration
3. No `requirements.txt` file
4. Relative imports depend on `sys.path` manipulation

**Flask App Status**: ✅ **PROPERLY EXPOSED**
- Flask app is correctly exposed at module level
- Vercel can detect Flask apps when properly configured

**Import Graph Status**: ⚠️ **FRAGILE**
- Absolute imports work (`from backend.controllers.*`)
- Relative imports depend on runtime path manipulation
- May fail in serverless environment

---

**End of Report**

