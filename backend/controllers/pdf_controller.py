from flask import Blueprint, jsonify, request
from services.s3_service import get_presigned_pdf_url

pdf_bp = Blueprint('pdf', __name__)

@pdf_bp.get('/test')
def pdf_test():
    return jsonify({"message": "pdf controller active"})

@pdf_bp.post('/url')
def get_pdf_url():
    data = request.get_json()
    lab_id = data.get("lab_id")
    document_id = data.get("document_id")
    
    if not lab_id or not document_id:
        return jsonify({"error": "Missing lab_id or document_id"}), 400
    
    result = get_presigned_pdf_url(lab_id, document_id)
    return jsonify(result)
