"""
Main Flask application entry point.
Cache-first API: serves prebuilt graph JSON instantly.
"""
import os
import json

from flask import Flask, jsonify, request
from flask_cors import CORS
from backend.controllers.rag_controller import rag_bp
from backend.controllers.recommendations_controller import recommendations_bp
from backend.controllers.pdf_controller import pdf_bp

app = Flask(__name__)

# Enable CORS for all origins (Vercel handles domain security)
CORS(app, origins=['*'])

# In-memory graph cache (lazy-loaded on first request)
_graph_cache = None


def load_graph_cache():
    """Load graph cache from disk into memory."""
    global _graph_cache
    
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(backend_dir)
    
    # List of paths to try, in order of preference
    paths_to_try = [
        os.path.join(backend_dir, "cache", "graph_cache.json"),  # backend/cache/
        os.path.join(project_root, "public", "graph_cache.json"),  # public/
        os.path.join(project_root, "dist", "graph_cache.json"),  # dist/ (Vite output)
        "/var/task/public/graph_cache.json",  # Vercel absolute path
        "/var/task/dist/graph_cache.json",  # Vercel dist path
    ]
    
    for cache_path in paths_to_try:
        cache_path = os.path.normpath(cache_path)
        if os.path.exists(cache_path):
            try:
                with open(cache_path, 'r', encoding='utf-8') as f:
                    _graph_cache = json.load(f)
                nodes = _graph_cache.get("nodes", [])
                links = _graph_cache.get("links", [])
                print(f"[OK] Graph cache loaded from {cache_path}: {len(nodes)} nodes, {len(links)} links")
                return True
            except Exception as e:
                print(f"[WARNING] Failed to load graph cache from {cache_path}: {e}")
    
    # Default to empty graph
    print(f"[WARNING] Graph cache not found in any location, using empty graph. Tried: {paths_to_try}")
    _graph_cache = {"nodes": [], "links": []}
    return False


# def save_graph_cache(graph_data):
#     """Save graph cache to disk."""
#     # DISABLED: Vercel serverless filesystem is read-only
#     backend_dir = os.path.dirname(os.path.abspath(__file__))
#     cache_dir = os.path.join(backend_dir, "cache")
#     os.makedirs(cache_dir, exist_ok=True)
#     
#     cache_path = os.path.join(cache_dir, "graph_cache.json")
#     try:
#         with open(cache_path, 'w', encoding='utf-8') as f:
#             json.dump(graph_data, f, indent=2, default=str)
#         return True
#     except Exception as e:
#         print(f"[ERROR] Failed to save graph cache: {e}")
#         return False

# Register blueprints
app.register_blueprint(rag_bp, url_prefix='/api/rag')
app.register_blueprint(recommendations_bp, url_prefix='/api/recommendations')
app.register_blueprint(pdf_bp, url_prefix='/api/pdf')

# Graph endpoints (cache-first, no DynamoDB except rebuild)
@app.route('/api/graph/data', methods=['GET'])
def get_graph_data():
    """
    Serve cached graph data instantly.
    Does NOT call DynamoDB.
    """
    global _graph_cache
    # Lazy load cache on first request
    if _graph_cache is None:
        load_graph_cache()
    return jsonify(_graph_cache)


@app.route('/api/graph/rebuild-cache', methods=['POST'])
def rebuild_cache():
    """
    Manually rebuild graph cache from DynamoDB.
    DISABLED: Cache writing disabled on Vercel (read-only filesystem).
    """
    return jsonify({
        "ok": False,
        "reason": "cache writing disabled on Vercel"
    }), 503


@app.route('/api/graph/paper-lab-id', methods=['POST'])
def paper_lab_id():
    """Get lab_id for a paper document."""
    from backend.services.dynamodb_service import fetch_papers
    
    data = request.get_json()
    document_id = data.get("document_id")
    
    if not document_id:
        return jsonify({"error": "document_id is required"}), 400
    
    papers = fetch_papers([document_id])
    
    if not papers:
        return jsonify({"lab_id": None})
    
    paper = papers[0]
    lab_id = paper.get("lab_id")
    
    return jsonify({"lab_id": lab_id})


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok"})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
