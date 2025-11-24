"""
CORS configuration utilities.
"""
from flask_cors import CORS


def apply_cors(app):
    """
    Apply CORS configuration to the Flask app instance.
    
    Args:
        app: Flask application instance
    """
    CORS(
        app,
        origins=['http://localhost:5173'],
        methods=['GET', 'POST', 'OPTIONS'],
        allow_headers=['Content-Type', 'Authorization'],
        supports_credentials=True
    )

