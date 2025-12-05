"""
Backend Wrapper Module.

Re-exports the Flask app for alternative import paths.
Kept for backwards compatibility with different deployment configurations.
"""
from backend.app import app

