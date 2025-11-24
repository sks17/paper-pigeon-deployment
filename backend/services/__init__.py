"""
Services package for AWS and business logic.
"""
from dotenv import load_dotenv
import os

# Resolve the backend directory (parent of services/)
backend_dir = os.path.dirname(os.path.dirname(__file__))
env_path = os.path.join(backend_dir, ".env")

# Load .env regardless of how the package is imported
load_dotenv(dotenv_path=env_path, override=True)


