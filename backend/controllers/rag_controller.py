from flask import Blueprint, jsonify, request
import traceback
import time
from backend.services.bedrock_service import rag_chat

rag_bp = Blueprint("rag", __name__)

@rag_bp.get('/test')
def rag_test():
    return jsonify({"message": "rag controller active"})

@rag_bp.post('/chat')
def chat():
    start_time = time.time()
    
    # DIAGNOSTICS: Log incoming request
    if not (hasattr(request, 'is_json') and request.is_json):
        if __import__('os').getenv('NODE_ENV') != 'production':
            print("[RAG DIAG] ERROR: Request is not JSON")
        return jsonify({"error": "Request must be JSON"}), 400
    
    data = request.get_json()
    
    # DIAGNOSTICS: Log payload shape
    if __import__('os').getenv('NODE_ENV') != 'production':
        print(f"[RAG DIAG] Incoming request payload keys: {list(data.keys()) if data else 'None'}")
        print(f"[RAG DIAG] Payload shape: query={type(data.get('query') if data else None)}, document_id={type(data.get('document_id') if data else None)}")
    
    query = data.get("query") if data else None
    document_id = data.get("document_id") if data else None
    
    # DIAGNOSTICS: Log extracted values
    if __import__('os').getenv('NODE_ENV') != 'production':
        print(f"[RAG DIAG] Extracted query: {query[:50] if query else None}... (length: {len(query) if query else 0})")
        print(f"[RAG DIAG] Extracted document_id: {document_id}")
    
    if not query or not document_id:
        if __import__('os').getenv('NODE_ENV') != 'production':
            print(f"[RAG DIAG] ERROR: Missing required fields - query={bool(query)}, document_id={bool(document_id)}")
        return jsonify({"error": "Missing query or document_id"}), 400
    
    # DIAGNOSTICS: Log before calling rag_chat
    if __import__('os').getenv('NODE_ENV') != 'production':
        print(f"[RAG DIAG] Calling rag_chat() with query length={len(query)}, document_id={document_id}")
        print(f"[RAG DIAG] Time before rag_chat: {time.time() - start_time:.3f}s")
    
    try:
        rag_start = time.time()
        response = rag_chat(query, document_id)
        rag_duration = time.time() - rag_start
        
        # DIAGNOSTICS: Log response from rag_chat
        if __import__('os').getenv('NODE_ENV') != 'production':
            print(f"[RAG DIAG] rag_chat() returned in {rag_duration:.3f}s")
            print(f"[RAG DIAG] Response type: {type(response)}")
            print(f"[RAG DIAG] Response keys: {list(response.keys()) if isinstance(response, dict) else 'Not a dict'}")
            print(f"[RAG DIAG] Response has 'answer': {'answer' in response if isinstance(response, dict) else False}")
            print(f"[RAG DIAG] Response has 'citations': {'citations' in response if isinstance(response, dict) else False}")
            print(f"[RAG DIAG] Answer length: {len(response.get('answer', '')) if isinstance(response, dict) else 0}")
            print(f"[RAG DIAG] Citations count: {len(response.get('citations', [])) if isinstance(response, dict) else 0}")
            print(f"[RAG DIAG] Total request time: {time.time() - start_time:.3f}s")
        
        return jsonify(response)
        
    except Exception as e:
        # DIAGNOSTICS: Log full error details
        error_type = type(e).__name__
        error_message = str(e)
        error_traceback = traceback.format_exc()
        
        if __import__('os').getenv('NODE_ENV') != 'production':
            print(f"[RAG DIAG] ERROR in chat() handler:")
            print(f"[RAG DIAG] Error type: {error_type}")
            print(f"[RAG DIAG] Error message: {error_message}")
            print(f"[RAG DIAG] Full traceback:")
            print(error_traceback)
            print(f"[RAG DIAG] Error occurred at time: {time.time() - start_time:.3f}s into request")
        
        return jsonify({
            "error": "RAG chat failed",
            "error_type": error_type,
            "message": error_message
        }), 500
