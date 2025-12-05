"""
Vercel Python Serverless Function Entry Point.

This file is the entry point for all /api/* routes on Vercel.
Vercel automatically detects the `app` Flask instance and serves it.

Routes are defined in backend/app.py and its registered blueprints.
"""
from backend.app import app
