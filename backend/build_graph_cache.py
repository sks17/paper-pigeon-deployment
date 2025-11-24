"""
Build and cache graph data locally.

This script:
1. Loads .env using absolute paths
2. Calls build_graph_data_pure() to construct the graph from DynamoDB
3. Saves it to backend/cache/graph_cache.json
4. Prints timing info

Runnable from project root:
    python backend/build_graph_cache.py
"""
import sys
import os
import json
import time

# Fix sys.path to allow importing backend as a package
script_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(script_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

# Load .env using absolute path (Windows-safe)
env_path = os.path.join(script_dir, ".env")
if os.path.exists(env_path):
    from dotenv import load_dotenv
    load_dotenv(env_path, override=True)
    print(f"Loaded .env from: {env_path}")
else:
    print(f"WARNING: .env file not found at {env_path}")

# Import backend package to trigger __init__.py (additional env loading)
import backend

# Use absolute import through backend package - pure Python, no Flask
from backend.graph_core import build_graph_data_pure


def main():
    """Build graph cache from DynamoDB."""
    print("=" * 60)
    print("Building graph cache...")
    print("=" * 60)
    
    start_time = time.time()
    
    try:
        # Build graph data using pure Python function (no Flask)
        print("Calling build_graph_data_pure()...")
        graph_data = build_graph_data_pure()
        
        build_time = time.time()
        build_duration = build_time - start_time
        
        nodes = graph_data.get("nodes", [])
        links = graph_data.get("links", [])
        
        print(f"\nGraph built in {build_duration:.2f} seconds")
        print(f"  Nodes: {len(nodes)}")
        print(f"  Links: {len(links)}")
        
        # Ensure cache directory exists
        cache_dir = os.path.join(script_dir, "cache")
        os.makedirs(cache_dir, exist_ok=True)
        
        # Write single cache file
        cache_path = os.path.join(cache_dir, "graph_cache.json")
        print(f"\nWriting cache to: {cache_path}")
        
        write_start = time.time()
        with open(cache_path, 'w', encoding='utf-8') as f:
            json.dump(graph_data, f, indent=2, default=str)
        write_duration = time.time() - write_start
        
        total_duration = time.time() - start_time
        
        print(f"Cache written in {write_duration:.2f} seconds")
        print(f"\n[OK] Graph cache written: {len(nodes)} nodes, {len(links)} links")
        print(f"Total time: {total_duration:.2f} seconds")
        print("=" * 60)
        return 0
        
    except MemoryError as e:
        print(f"\n[ERROR] MemoryError: {e}")
        print("The graph data is too large to process. Consider:")
        print("  - Increasing available memory")
        print("  - Processing in smaller batches")
        return 1
        
    except Exception as e:
        print(f"\n[ERROR] Failed to build graph cache: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)
