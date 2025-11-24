from flask import Blueprint, jsonify, request
from services.bedrock_service import rag_chat

rag_bp = Blueprint("rag", __name__)

@rag_bp.get('/test')
def rag_test():
    return jsonify({"message": "rag controller active"})

@rag_bp.post('/chat')
def chat():
    data = request.get_json()
    query = data.get("query")
    document_id = data.get("document_id")
    
    if not query or not document_id:
        return jsonify({"error": "Missing query or document_id"}), 400
    
    response = rag_chat(query, document_id)
    return jsonify(response)
