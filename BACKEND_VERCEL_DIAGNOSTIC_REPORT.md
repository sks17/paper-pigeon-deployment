# Backend Vercel Diagnostic Report

**Purpose**: Identify all issues that would cause Vercel Python serverless function crashes  
**Date**: Current  
**Scope**: Complete backend analysis for Vercel deployment

---

## Executive Summary

**Critical Issues Found**: 8  
**High Priority Issues**: 5  
**Medium Priority Issues**: 3  
**Total Potential Crash Points**: 16

---

## 1. Import-Time Execution Issues

### CRITICAL: Code Executed at Module Import Time

#### Issue 1.1: `backend/__init__.py` (Line 3)
```python
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
```
**Problem**: Executes at import time, tries to load `backend/.env` file  
**Impact**: 
- File won't exist in Vercel (silent failure, but wastes time)
- May cause import delays
**Stack Trace** (simulated):
```
ImportError: Could delay import if dotenv fails unexpectedly
```

#### Issue 1.2: `backend/services/__init__.py` (Lines 8-12)
```python
backend_dir = os.path.dirname(os.path.dirname(__file__))
env_path = os.path.join(backend_dir, ".env")
load_dotenv(dotenv_path=env_path, override=True)
```
**Problem**: Executes at import time when any service is imported  
**Impact**: 
- Tries to load `.env` file that doesn't exist in Vercel
- Overrides environment variables (may conflict with Vercel env vars)
**Stack Trace** (simulated):
```
FileNotFoundError: backend/.env (silent, but unnecessary)
```

#### Issue 1.3: `backend/app.py` (Line 89)
```python
# Load cache on startup
load_graph_cache()
```
**Problem**: Executes at module import time (when `backend.app` is imported)  
**Impact**: 
- Runs on every cold start
- May fail if file paths don't resolve correctly
- Blocks import until file I/O completes
**Stack Trace** (if path resolution fails):
```
FileNotFoundError: [Errno 2] No such file or directory: '.../backend/cache/graph_cache.json'
```

#### Issue 1.4: `backend/services/dynamodb_service.py` (Line 6)
```python
print("ENV BEFORE DYNAMODB:", {k: os.getenv(k) for k in ["AWS_REGION", "AWS_ACCESS_KEY_ID"]})
```
**Problem**: Executes at import time, prints environment variables  
**Impact**: 
- Security risk: May log credentials in Vercel logs
- Unnecessary execution on every import
- Clutters logs

---

## 2. File System Path Issues

### CRITICAL: Paths That Won't Exist in Vercel

#### Issue 2.1: `backend/__init__.py` - .env File Path
```python
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
```
**Path**: `backend/.env`  
**Status**: ❌ Will not exist in Vercel  
**Impact**: Silent failure (no error, but unnecessary file I/O)

#### Issue 2.2: `backend/services/__init__.py` - .env File Path
```python
backend_dir = os.path.dirname(os.path.dirname(__file__))
env_path = os.path.join(backend_dir, ".env")
```
**Path**: `backend/.env`  
**Status**: ❌ Will not exist in Vercel  
**Impact**: Silent failure, but `override=True` may cause issues

#### Issue 2.3: `backend/app.py` - Cache Directory Path
```python
backend_dir = os.path.dirname(os.path.abspath(__file__))
cache_path = os.path.join(backend_dir, "cache", "graph_cache.json")
```
**Path**: `backend/cache/graph_cache.json`  
**Status**: ⚠️ May not exist in Vercel deployment  
**Impact**: Falls back to public file (handled, but may cause delay)

#### Issue 2.4: `backend/app.py` - Public File Path Resolution
```python
public_path = os.path.join(os.path.dirname(__file__), "..", "public", "graph_cache.json")
public_path = os.path.normpath(public_path)
```
**Path**: `../public/graph_cache.json` (relative to `backend/app.py`)  
**Status**: ⚠️ Path resolution may fail in Vercel serverless  
**Impact**: 
- Relative path `..` may not resolve correctly in Vercel's filesystem structure
- Could result in `FileNotFoundError` if path doesn't resolve
**Potential Stack Trace**:
```
FileNotFoundError: [Errno 2] No such file or directory: '/var/task/../public/graph_cache.json'
```

#### Issue 2.5: `backend/app.py` - Write Operation (Line 72-85)
```python
def save_graph_cache(graph_data):
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    cache_dir = os.path.join(backend_dir, "cache")
    os.makedirs(cache_dir, exist_ok=True)  # ⚠️ Will fail in read-only filesystem
```
**Path**: `backend/cache/` (write operation)  
**Status**: ❌ Vercel serverless filesystem is read-only  
**Impact**: 
- `os.makedirs()` will fail silently or raise `PermissionError`
- `save_graph_cache()` will always return `False` in production
- `/api/graph/rebuild-cache` endpoint will return 500 error
**Potential Stack Trace**:
```
PermissionError: [Errno 13] Permission denied: '/var/task/backend/cache'
```

---

## 3. Import Path Verification

### Import Chain Analysis

#### Entry Point: `api/index.py`
```python
from backend_wrapper import app as application
```
**Status**: ✅ Correct

#### Wrapper: `backend_wrapper.py`
```python
from backend.app import app
```
**Status**: ✅ Correct

#### Main App: `backend/app.py`
**Imports**:
- `import backend` ✅
- `from backend.controllers.rag_controller import rag_bp` ✅
- `from backend.controllers.recommendations_controller import recommendations_bp` ✅
- `from backend.controllers.pdf_controller import pdf_bp` ✅

#### Controllers
**rag_controller.py**:
- `from backend.services.bedrock_service import rag_chat` ✅

**pdf_controller.py**:
- `from backend.services.s3_service import get_presigned_pdf_url` ✅

**recommendations_controller.py**:
- `from backend.services.bedrock_service import rag_recommend` ✅

#### Services
**dynamodb_service.py**:
- `import os` ✅
- `import boto3` ✅
- `from boto3.dynamodb.conditions import Attr` ✅

**s3_service.py**:
- `import os` ✅
- `import boto3` ✅

**bedrock_service.py**:
- `import os` ✅
- `import json` ✅
- `import boto3` ✅

#### Graph Core
**graph_core.py**:
- `from backend.services.dynamodb_service import (...)` ✅

**Result**: ✅ All imports use fully-qualified paths. No relative import issues found.

---

## 4. Environment Variable Loading Issues

### Issue 4.1: Duplicate .env Loading
**Locations**:
1. `backend/__init__.py` (line 3)
2. `backend/services/__init__.py` (line 12)

**Problem**: Both try to load `backend/.env` file  
**Impact**: 
- Redundant file I/O
- `services/__init__.py` uses `override=True` which may override Vercel env vars if `.env` exists
- Silent failures if file doesn't exist

### Issue 4.2: Environment Variables Required But May Be Missing

**bedrock_service.py**:
- `AWS_ACCESS_KEY_ID` (line 15) - Required
- `AWS_SECRET_ACCESS_KEY` (line 16) - Required
- `AWS_REGION` (line 17) - Required
- `BEDROCK_KNOWLEDGE_BASE_ID` (line 34) - Required
- `BEDROCK_DATA_SOURCE_ID` (line 35) - Required
- `BEDROCK_KNOWLEDGE_BASE_ID_2` (line 79) - Required

**s3_service.py**:
- `AWS_REGION` (line 21) - Required
- `S3_BUCKET_NAME` (line 24) - Required

**dynamodb_service.py**:
- `AWS_REGION` (line 18) - Required (uses boto3 default credentials)

**Impact**: If any required env var is missing, services will crash:
- `bedrock_service.rag_chat()` → `TypeError` or `ClientError`
- `bedrock_service.rag_recommend()` → `TypeError` or `ClientError`
- `s3_service.get_presigned_pdf_url()` → `TypeError` or `ClientError`
- `dynamodb_service.get_dynamodb()` → `NoRegionError` or `ClientError`

---

## 5. Error Handling Issues

### Issue 5.1: No Error Handling in Service Functions

**bedrock_service.py**:
- `rag_chat()` (line 21-64): No try/except around `client.retrieve_and_generate()`
- `rag_recommend()` (line 67-106): No try/except around `client.retrieve_and_generate()`

**Potential Stack Traces**:
```
botocore.exceptions.ClientError: An error occurred (AccessDeniedException) when calling the RetrieveAndGenerate operation
TypeError: argument of type 'NoneType' is not iterable  # if knowledge_base_id is None
```

**s3_service.py**:
- `get_presigned_pdf_url()` (line 8-33): No try/except around `s3.generate_presigned_url()`

**Potential Stack Traces**:
```
TypeError: generate_presigned_url() missing 1 required positional argument: 'Bucket'  # if S3_BUCKET_NAME is None
botocore.exceptions.ClientError: An error occurred (NoSuchBucket) when calling the GeneratePresignedUrl operation
```

**dynamodb_service.py**:
- `get_dynamodb()` (line 14-23): No error handling if `AWS_REGION` is None

**Potential Stack Trace**:
```
botocore.exceptions.NoRegionError: You must specify a region.
```

### Issue 5.2: Controllers Don't Catch Service Exceptions

**rag_controller.py** (line 19):
```python
response = rag_chat(query, document_id)
return jsonify(response)
```
**Problem**: No try/except - will return 500 if `rag_chat()` raises exception

**pdf_controller.py** (line 19):
```python
result = get_presigned_pdf_url(lab_id, document_id)
return jsonify(result)
```
**Problem**: No try/except - will return 500 if `get_presigned_pdf_url()` raises exception

**recommendations_controller.py** (line 18):
```python
result = rag_recommend(resume_text)
return jsonify(result)
```
**Problem**: No try/except - will return 500 if `rag_recommend()` raises exception

---

## 6. CORS Configuration Issue

### Issue 6.1: Hardcoded CORS Origins
**Location**: `backend/app.py` (line 26)
```python
CORS(app, origins=['http://localhost:5173'])
```
**Problem**: Only allows `localhost:5173`  
**Impact**: 
- Production frontend requests will be blocked
- Returns CORS error to browser
- API calls from production domain will fail

---

## 7. sys.path Manipulation

### Issue 7.1: Path Manipulation in app.py
**Location**: `backend/app.py` (lines 10-12)
```python
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)
```
**Status**: ⚠️ May cause issues in Vercel  
**Impact**: 
- Path resolution may differ in Vercel's serverless environment
- May not be necessary if imports are fully qualified (which they are)
- Could cause import conflicts if path structure differs

---

## 8. Module Import Order Dependencies

### Issue 8.1: Import Chain Execution Order

**Import Sequence**:
1. `api/index.py` imports `backend_wrapper`
2. `backend_wrapper.py` imports `backend.app`
3. `backend/app.py` imports `backend` (triggers `backend/__init__.py`)
4. `backend/__init__.py` executes `load_dotenv()` (tries to load `.env`)
5. `backend/app.py` imports controllers
6. Controllers import services (triggers `backend/services/__init__.py`)
7. `backend/services/__init__.py` executes `load_dotenv()` again
8. `backend/app.py` calls `load_graph_cache()` at module level

**Impact**: 
- Multiple file I/O operations during import
- Sequential execution may cause delays
- If any step fails unexpectedly, entire import fails

---

## 9. Potential Stack Traces (Simulated)

### Stack Trace 1: Missing Environment Variable
```
Traceback (most recent call last):
  File "/var/task/api/index.py", line 1, in <module>
    from backend_wrapper import app as application
  File "/var/task/backend_wrapper.py", line 1, in <module>
    from backend.app import app
  File "/var/task/backend/app.py", line 19, in <module>
    from backend.controllers.rag_controller import rag_bp
  File "/var/task/backend/controllers/rag_controller.py", line 2, in <module>
    from backend.services.bedrock_service import rag_chat
  File "/var/task/backend/services/bedrock_service.py", line 13, in <module>
    # Module loads successfully, but...
  # Later, when rag_chat() is called:
  File "/var/task/backend/services/bedrock_service.py", line 34, in rag_chat
    knowledge_base_id = os.getenv("BEDROCK_KNOWLEDGE_BASE_ID")
    # Returns None
  File "/var/task/backend/services/bedrock_service.py", line 42, in rag_chat
    "knowledgeBaseId": knowledge_base_id,  # None passed to AWS API
  # Results in:
  botocore.exceptions.ClientError: An error occurred (ValidationException) when calling the RetrieveAndGenerate operation: Invalid knowledge base ID
```

### Stack Trace 2: File System Write Permission
```
Traceback (most recent call last):
  File "/var/task/backend/app.py", line 125, in rebuild_cache
    if save_graph_cache(graph_data):
  File "/var/task/backend/app.py", line 76, in save_graph_cache
    os.makedirs(cache_dir, exist_ok=True)
PermissionError: [Errno 13] Permission denied: '/var/task/backend/cache'
```

### Stack Trace 3: Path Resolution Failure
```
Traceback (most recent call last):
  File "/var/task/backend/app.py", line 89, in <module>
    load_graph_cache()
  File "/var/task/backend/app.py", line 55, in load_graph_cache
    if os.path.exists(public_path):
  # If path resolution fails:
  FileNotFoundError: [Errno 2] No such file or directory: '/var/task/../public/graph_cache.json'
```

### Stack Trace 4: Missing S3 Bucket Name
```
Traceback (most recent call last):
  File "/var/task/backend/controllers/pdf_controller.py", line 19, in get_pdf_url
    result = get_presigned_pdf_url(lab_id, document_id)
  File "/var/task/backend/services/s3_service.py", line 27, in get_presigned_pdf_url
    presigned_url = s3.generate_presigned_url(
  File "/var/task/boto3/client.py", line ...
TypeError: generate_presigned_url() missing 1 required positional argument: 'Bucket'
```

---

## 10. Summary of Crash Points

### Critical (Will Cause 500 Errors)

1. **Missing AWS Environment Variables**:
   - `BEDROCK_KNOWLEDGE_BASE_ID` → `rag_chat()` crashes
   - `BEDROCK_DATA_SOURCE_ID` → `rag_chat()` crashes
   - `BEDROCK_KNOWLEDGE_BASE_ID_2` → `rag_recommend()` crashes
   - `S3_BUCKET_NAME` → `get_presigned_pdf_url()` crashes
   - `AWS_REGION` → All AWS services crash

2. **File System Write Operations**:
   - `save_graph_cache()` → PermissionError in `/api/graph/rebuild-cache`

3. **CORS Configuration**:
   - Production frontend requests blocked → Browser CORS errors

### High Priority (May Cause 500 Errors)

4. **Path Resolution**:
   - `public/graph_cache.json` path may not resolve correctly

5. **No Error Handling in Services**:
   - AWS API errors propagate to controllers → 500 errors

6. **No Error Handling in Controllers**:
   - Service exceptions not caught → 500 errors

### Medium Priority (Performance/Logging Issues)

7. **Import-Time Execution**:
   - `load_graph_cache()` runs on every cold start
   - `.env` file loading attempts (silent failures)

8. **Security/Logging**:
   - Environment variables printed to logs (line 6 in dynamodb_service.py)

---

## 11. Modules That Cannot Be Imported

**Status**: ✅ All modules can be imported  
**Verification**: All import paths are fully qualified and correct

**Potential Issues**:
- If `boto3` is not in `requirements.txt` → ImportError (but it is listed)
- If `flask` or `flask-cors` missing → ImportError (but they are listed)

---

## 12. Paths That Do Not Exist in Vercel

1. ❌ `backend/.env` - Will not exist (environment variables come from Vercel dashboard)
2. ⚠️ `backend/cache/graph_cache.json` - May not exist (falls back to public file)
3. ⚠️ `../public/graph_cache.json` - Path resolution may fail
4. ❌ `backend/cache/` (write directory) - Read-only filesystem, cannot create

---

## 13. Backend Startup Crash Points

### Startup Sequence Analysis

**Phase 1: Module Import**
1. `api/index.py` imports `backend_wrapper` ✅
2. `backend_wrapper.py` imports `backend.app` ✅
3. `backend/app.py` line 10-12: `sys.path` manipulation ⚠️
4. `backend/app.py` line 15: `import backend` triggers `backend/__init__.py`
5. `backend/__init__.py` line 3: `load_dotenv()` tries to load `.env` ⚠️ (silent failure)
6. `backend/app.py` line 19-21: Import controllers ✅
7. Controllers import services, triggers `backend/services/__init__.py`
8. `backend/services/__init__.py` line 12: `load_dotenv()` again ⚠️ (silent failure)
9. `backend/app.py` line 89: `load_graph_cache()` executes ⚠️ (file I/O)

**Potential Failure Points**:
- Step 5: `.env` file not found (silent, but unnecessary)
- Step 8: `.env` file not found (silent, but unnecessary)
- Step 9: Path resolution failure → Could crash if exception not caught

**Phase 2: Request Handling**
- Missing env vars → Service functions crash
- AWS API errors → Service functions crash
- No error handling → Controllers return 500

---

## 14. Recommendations Summary

### Must Fix Before Deployment

1. Remove `.env` file loading from `backend/__init__.py` and `backend/services/__init__.py`
2. Add error handling to all service functions
3. Add error handling to all controller endpoints
4. Fix CORS to allow production origins
5. Remove or guard `save_graph_cache()` write operations
6. Remove debug print statements that log credentials
7. Verify `public/graph_cache.json` path resolution works in Vercel

### Should Fix for Production

8. Move `load_graph_cache()` to lazy loading (not at import time)
9. Add graceful fallbacks for missing AWS credentials
10. Remove unnecessary `sys.path` manipulation

---

**End of Diagnostic Report**

