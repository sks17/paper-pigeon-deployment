"""
Main Flask application entry point.
Cache-first API: serves prebuilt graph JSON instantly.
"""
import sys
import os
import json

# Add parent directory to path so backend can be imported as a package
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

# Import backend package to trigger __init__.py and load environment variables
import backend

from flask import Flask, jsonify, request
from flask_cors import CORS
from backend.controllers.rag_controller import rag_bp
from backend.controllers.recommendations_controller import recommendations_bp
from backend.controllers.pdf_controller import pdf_bp

app = Flask(__name__)

# Enable CORS for localhost:5173 only
CORS(app, origins=['http://localhost:5173'])

# In-memory graph cache (loaded on startup)
_graph_cache = {"nodes": [], "links": []}


def load_graph_cache():
    """Load graph cache from disk into memory."""
    global _graph_cache
    
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    cache_path = os.path.join(backend_dir, "cache", "graph_cache.json")
    
    # Try backend/cache/graph_cache.json first
    if os.path.exists(cache_path):
        try:
            with open(cache_path, 'r', encoding='utf-8') as f:
                _graph_cache = json.load(f)
            nodes = _graph_cache.get("nodes", [])
            links = _graph_cache.get("links", [])
            print(f"[OK] Graph cache loaded from backend/cache: {len(nodes)} nodes, {len(links)} links")
            return True
        except Exception as e:
            print(f"[WARNING] Failed to load graph cache from backend/cache: {e}")
    
    # Fallback to public/graph_cache.json
    public_path = os.path.join(os.path.dirname(__file__), "..", "public", "graph_cache.json")
    public_path = os.path.normpath(public_path)
    
    if os.path.exists(public_path):
        try:
            with open(public_path, 'r', encoding='utf-8') as f:
                _graph_cache = json.load(f)
            nodes = _graph_cache.get("nodes", [])
            links = _graph_cache.get("links", [])
            print(f"[OK] Graph cache loaded from public/static: {len(nodes)} nodes, {len(links)} links")
            return True
        except Exception as e:
            print(f"[WARNING] Failed to load graph cache from public/static: {e}")
    
    # Default to empty graph
    print("[WARNING] Graph cache not found in backend/cache or public/static, using empty graph")
    _graph_cache = {"nodes": [], "links": []}
    return False


def save_graph_cache(graph_data):
    """Save graph cache to disk."""
    backend_dir = os.path.dirname(os.path.abspath(__file__))
    cache_dir = os.path.join(backend_dir, "cache")
    os.makedirs(cache_dir, exist_ok=True)
    
    cache_path = os.path.join(cache_dir, "graph_cache.json")
    try:
        with open(cache_path, 'w', encoding='utf-8') as f:
            json.dump(graph_data, f, indent=2, default=str)
        return True
    except Exception as e:
        print(f"[ERROR] Failed to save graph cache: {e}")
        return False


# Load cache on startup
load_graph_cache()

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
    return jsonify(_graph_cache)


@app.route('/api/graph/rebuild-cache', methods=['POST'])
def rebuild_cache():
    """
    Manually rebuild graph cache from DynamoDB.
    Updates both disk cache and in-memory cache.
    """
    global _graph_cache
    
    try:
        print("[REBUILD] Starting graph cache rebuild...")
        from backend.graph_core import build_graph_data_pure
        
        # Build graph from DynamoDB
        graph_data = build_graph_data_pure()
        
        # Update in-memory cache
        _graph_cache = graph_data
        
        # Update disk cache
        if save_graph_cache(graph_data):
            nodes = graph_data.get("nodes", [])
            links = graph_data.get("links", [])
            print(f"[REBUILD] Cache rebuilt: {len(nodes)} nodes, {len(links)} links")
            return jsonify({
                "success": True,
                "message": "Graph cache rebuilt successfully",
                "nodes": len(nodes),
                "links": len(links)
            })
        else:
            return jsonify({
                "success": False,
                "message": "Graph rebuilt but failed to save to disk"
            }), 500
            
    except Exception as e:
        print(f"[REBUILD] Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


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
