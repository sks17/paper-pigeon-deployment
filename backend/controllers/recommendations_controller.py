from flask import Blueprint, jsonify, request
from services.bedrock_service import rag_recommend

recommendations_bp = Blueprint('recommendations', __name__)

@recommendations_bp.get('/test')
def recommendations_test():
    return jsonify({"message": "recommendations controller active"})

@recommendations_bp.post("/from-resume")
def recommend_from_resume():
    data = request.get_json()
    resume_text = data.get("resume_text")
    
    if not resume_text:
        return jsonify({"error": "Missing resume_text"}), 400
    
    result = rag_recommend(resume_text)
    return jsonify(result)
