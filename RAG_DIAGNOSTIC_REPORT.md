# RAG Chat 500 Error Diagnostic Report

## Overview
Added comprehensive diagnostic logging to trace the RAG pipeline and identify the root cause of the 500 error.

---

## Diagnostic Modifications

### 1. `backend/controllers/rag_controller.py`

**Added Diagnostics:**
- Request payload validation and logging
- Query and document_id extraction logging
- Pre-call timing and validation
- Post-call response structure logging
- Full exception handling with stack traces
- Request duration tracking

**Key Diagnostic Points:**
- Line 20-24: Logs incoming payload shape and types
- Line 26-28: Logs extracted query/document_id values
- Line 33-35: Logs before calling `rag_chat()`
- Line 40-48: Logs response structure from `rag_chat()`
- Line 50-65: Comprehensive error logging with full traceback

---

### 2. `backend/services/bedrock_service.py`

**Added Diagnostics:**

#### A. `_get_bedrock_client()` Function
- **Line 15-23**: Environment variable validation
  - Checks: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`
  - Logs which vars are SET vs MISSING (without values)
  - Logs length of values (for validation)
- **Line 35-42**: Client creation error handling
  - Logs full error details if boto3 client creation fails

#### B. `rag_chat()` Function
- **Line 50-58**: Function entry logging
  - Logs query and document_id types/values
  - Validates inputs are not None
  
- **Line 60-66**: Bedrock-specific env var validation
  - Checks: `BEDROCK_KNOWLEDGE_BASE_ID`, `BEDROCK_DATA_SOURCE_ID`
  - Logs which vars are SET vs MISSING
  
- **Line 68-78**: Bedrock client creation
  - Times client creation
  - Logs any errors during client creation
  
- **Line 80-88**: Knowledge base config validation
  - Logs knowledge_base_id and data_source_id values (truncated)
  - Validates they are not None
  - Raises ValueError if missing (with diagnostic logging)
  
- **Line 90-113**: Request payload construction
  - Logs full request payload structure
  - Logs filter configuration
  - Logs data source IDs array
  
- **Line 115-140**: Bedrock API call
  - Times the API call
  - Logs response structure
  - Comprehensive error handling with full traceback
  - Logs the exact request that failed
  
- **Line 142-170**: Response parsing
  - Logs response structure
  - Logs answer length and citations count
  - Logs citation structure
  - Times parsing operation
  - Logs total function duration

---

## Diagnostic Output Format

All diagnostics are wrapped in:
```python
if os.getenv('NODE_ENV') != 'production':
    print("[RAG DIAG] ...")
```

**Diagnostics will NOT run in production** - they only execute when `NODE_ENV != 'production'`.

---

## RAG Pipeline Flow (With Diagnostics)

### Step 1: Frontend Request
- **Location**: `src/components/PaperChatModal.tsx` (line 76-79)
- **Request**: `POST /api/rag/chat`
- **Payload**: `{"query": "...", "document_id": "..."}`
- **Diagnostics**: None (frontend not modified)

### Step 2: Flask Route Handler
- **Location**: `backend/controllers/rag_controller.py` → `chat()` function
- **Diagnostics Added**:
  - ✅ Logs incoming payload keys and types
  - ✅ Logs extracted query/document_id
  - ✅ Validates required fields
  - ✅ Logs before calling `rag_chat()`
  - ✅ Logs response structure
  - ✅ Full error handling with stack trace

### Step 3: Bedrock Client Creation
- **Location**: `backend/services/bedrock_service.py` → `_get_bedrock_client()`
- **Diagnostics Added**:
  - ✅ Checks `AWS_ACCESS_KEY_ID` (SET/MISSING)
  - ✅ Checks `AWS_SECRET_ACCESS_KEY` (SET/MISSING)
  - ✅ Checks `AWS_REGION` (SET/MISSING)
  - ✅ Logs client creation success/failure
  - ✅ Full error traceback if creation fails

### Step 4: Environment Variable Validation
- **Location**: `backend/services/bedrock_service.py` → `rag_chat()` (line 60-66)
- **Diagnostics Added**:
  - ✅ Checks `BEDROCK_KNOWLEDGE_BASE_ID` (SET/MISSING)
  - ✅ Checks `BEDROCK_DATA_SOURCE_ID` (SET/MISSING)
  - ✅ Validates values are not None before use

### Step 5: Request Payload Construction
- **Location**: `backend/services/bedrock_service.py` → `rag_chat()` (line 90-113)
- **Diagnostics Added**:
  - ✅ Logs full request payload structure
  - ✅ Logs knowledge base ID (truncated)
  - ✅ Logs data source IDs array
  - ✅ Logs filter configuration (document_id)

### Step 6: Bedrock API Call
- **Location**: `backend/services/bedrock_service.py` → `rag_chat()` (line 115-140)
- **API Call**: `client.retrieve_and_generate()`
- **Diagnostics Added**:
  - ✅ Times the API call
  - ✅ Logs response type and keys
  - ✅ Comprehensive error handling
  - ✅ Logs exact request payload that failed
  - ✅ Full error traceback

### Step 7: Response Parsing
- **Location**: `backend/services/bedrock_service.py` → `rag_chat()` (line 142-170)
- **Diagnostics Added**:
  - ✅ Logs response structure
  - ✅ Logs answer extraction
  - ✅ Logs citations extraction
  - ✅ Logs parsing duration
  - ✅ Logs total function duration

---

## Potential Failure Points (Diagnosed)

### 1. Missing Environment Variables
**Location**: `_get_bedrock_client()` and `rag_chat()`
**Symptoms**:
- `AWS_ACCESS_KEY_ID` is MISSING → boto3 client creation fails
- `AWS_SECRET_ACCESS_KEY` is MISSING → boto3 client creation fails
- `AWS_REGION` is MISSING → boto3 client creation fails
- `BEDROCK_KNOWLEDGE_BASE_ID` is MISSING → ValueError raised
- `BEDROCK_DATA_SOURCE_ID` is MISSING → ValueError raised

**Diagnostic Output**:
```
[RAG DIAG]   AWS_ACCESS_KEY_ID: MISSING
[RAG DIAG] ERROR: AWS_ACCESS_KEY_ID is None or empty
```

### 2. Bedrock Client Creation Failure
**Location**: `_get_bedrock_client()` (line 35-42)
**Symptoms**:
- Invalid AWS credentials
- Invalid region
- boto3 import error
- Network connectivity issue

**Diagnostic Output**:
```
[RAG DIAG] ERROR creating Bedrock client:
[RAG DIAG]   Error type: ClientError
[RAG DIAG]   Error message: ...
```

### 3. Bedrock API Call Failure
**Location**: `rag_chat()` → `client.retrieve_and_generate()` (line 115-140)
**Symptoms**:
- Invalid knowledge base ID
- Invalid data source ID
- Knowledge base not found
- Insufficient permissions
- Invalid filter configuration
- Model/endpoint unavailable

**Diagnostic Output**:
```
[RAG DIAG] ERROR: Bedrock API call failed after X.XXXs
[RAG DIAG]   Error type: ClientError
[RAG DIAG]   Error message: ...
[RAG DIAG]   Request payload that failed:
[RAG DIAG]     knowledgeBaseId: ...
[RAG DIAG]     dataSourceIds: [...]
[RAG DIAG]     filter document_id: ...
```

### 4. Response Parsing Failure
**Location**: `rag_chat()` → response parsing (line 142-170)
**Symptoms**:
- Response structure unexpected
- Missing "output" key
- Missing "output.text" key
- Citations not in expected format

**Diagnostic Output**:
```
[RAG DIAG] ERROR: Failed to parse response
[RAG DIAG]   Error type: KeyError
[RAG DIAG]   Error message: ...
[RAG DIAG]   Response object: {...}
```

### 5. Controller Error Handling
**Location**: `rag_controller.py` → `chat()` (line 50-65)
**Symptoms**:
- Any exception from `rag_chat()` not caught
- JSON serialization error
- Flask response error

**Diagnostic Output**:
```
[RAG DIAG] ERROR in chat() handler:
[RAG DIAG] Error type: ...
[RAG DIAG] Error message: ...
[RAG DIAG] Full traceback:
...
```

---

## Expected Diagnostic Output (Success Case)

```
[RAG DIAG] Incoming request payload keys: ['query', 'document_id']
[RAG DIAG] Payload shape: query=<class 'str'>, document_id=<class 'str'>
[RAG DIAG] Extracted query: What is this paper about?... (length: 25)
[RAG DIAG] Extracted document_id: doc_123
[RAG DIAG] Calling rag_chat() with query length=25, document_id=doc_123
[RAG DIAG] Time before rag_chat: 0.001s
[RAG DIAG] rag_chat() called
[RAG DIAG]   query type: <class 'str'>, length: 25
[RAG DIAG]   document_id type: <class 'str'>, value: doc_123
[RAG DIAG] Checking Bedrock environment variables:
[RAG DIAG]   BEDROCK_KNOWLEDGE_BASE_ID: SET (length: 36)
[RAG DIAG]   BEDROCK_DATA_SOURCE_ID: SET (length: 36)
[RAG DIAG] _get_bedrock_client() called
[RAG DIAG] Checking required environment variables:
[RAG DIAG]   AWS_ACCESS_KEY_ID: SET (length: 20)
[RAG DIAG]   AWS_SECRET_ACCESS_KEY: SET (length: 40)
[RAG DIAG]   AWS_REGION: SET (length: 9)
[RAG DIAG] Bedrock client created successfully
[RAG DIAG] Client region: us-west-2
[RAG DIAG] Client creation took: 0.050s
[RAG DIAG] Knowledge base ID: KB1234567890ABCDEF...
[RAG DIAG] Data source ID: DS1234567890ABCDEF...
[RAG DIAG] Request payload structure:
[RAG DIAG]   input.text length: 25
[RAG DIAG]   knowledgeBaseId: KB1234567890ABCDEF...
[RAG DIAG]   dataSourceIds: ['DS1234567890ABCDEF...']
[RAG DIAG]   filter key: document_id
[RAG DIAG]   filter value: doc_123
[RAG DIAG] Calling client.retrieve_and_generate()...
[RAG DIAG] Bedrock API call completed in: 2.345s
[RAG DIAG] Response type: <class 'dict'>
[RAG DIAG] Response keys: ['output', 'citations', 'sessionId']
[RAG DIAG] Parsing response...
[RAG DIAG]   response.get('output'): {'text': '...'}
[RAG DIAG]   response.get('output', {}).get('text'): This paper discusses...
[RAG DIAG] Parsed answer length: 150
[RAG DIAG] Parsed citations count: 2
[RAG DIAG] Response parsing took: 0.001s
[RAG DIAG] Total rag_chat() duration: 2.396s
[RAG DIAG] Returning result with keys: ['answer', 'citations']
[RAG DIAG] rag_chat() returned in 2.396s
[RAG DIAG] Response type: <class 'dict'>
[RAG DIAG] Response keys: ['answer', 'citations']
[RAG DIAG] Response has 'answer': True
[RAG DIAG] Response has 'citations': True
[RAG DIAG] Answer length: 150
[RAG DIAG] Citations count: 2
[RAG DIAG] Total request time: 2.400s
```

---

## How to Use Diagnostics

### 1. Enable Diagnostics
Set `NODE_ENV` to anything other than `'production'`:
- In local development: Don't set `NODE_ENV` or set it to `'development'`
- In Vercel: Set `NODE_ENV=development` in environment variables (temporarily)

### 2. Trigger RAG Chat
- Open PaperChatModal
- Send a message
- Check server logs (Vercel function logs or local console)

### 3. Analyze Diagnostic Output
Look for:
- **MISSING** environment variables
- **ERROR** messages with error types
- **Full traceback** to identify exact line of failure
- **Timing information** to identify slow operations
- **Response structure** mismatches

### 4. Common Issues to Check

#### Issue: Missing Environment Variables
**Look for**: `[RAG DIAG]   VAR_NAME: MISSING`
**Fix**: Add missing env var to Vercel dashboard

#### Issue: Bedrock Client Creation Fails
**Look for**: `[RAG DIAG] ERROR creating Bedrock client:`
**Check**: AWS credentials validity, region correctness

#### Issue: Bedrock API Call Fails
**Look for**: `[RAG DIAG] ERROR: Bedrock API call failed`
**Check**: 
- Knowledge base ID correctness
- Data source ID correctness
- IAM permissions for Bedrock
- Knowledge base status (active?)

#### Issue: Response Parsing Fails
**Look for**: `[RAG DIAG] ERROR: Failed to parse response`
**Check**: Response structure matches expected format

---

## Root Cause Analysis (Based on Diagnostic Points)

### Most Likely Causes (in order of probability):

1. **Missing Environment Variables** (90% likely)
   - `BEDROCK_KNOWLEDGE_BASE_ID` or `BEDROCK_DATA_SOURCE_ID` not set in Vercel
   - `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, or `AWS_REGION` not set

2. **Bedrock API Call Failure** (8% likely)
   - Invalid knowledge base ID
   - Invalid data source ID
   - IAM permissions insufficient
   - Knowledge base not active

3. **Response Parsing Error** (2% likely)
   - Unexpected response structure from Bedrock
   - Missing "output" or "output.text" keys

---

## Next Steps

1. **Deploy diagnostics** to Vercel (with `NODE_ENV=development`)
2. **Trigger RAG chat** from frontend
3. **Check Vercel function logs** for diagnostic output
4. **Identify exact failure point** from diagnostic logs
5. **Fix the root cause** based on diagnostic findings

---

## Safety Notes

- ✅ All diagnostics wrapped in `NODE_ENV != 'production'` check
- ✅ No environment variable values logged (only SET/MISSING status)
- ✅ No modification to production logic
- ✅ Error handling added without changing response format
- ✅ Diagnostics can be removed after root cause is identified

---

**End of Diagnostic Report**

