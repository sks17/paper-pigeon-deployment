"""
Debug script to profile the graph data construction function.
Measures runtime and prints statistics about the generated graph.
"""
import sys
import os
import time
import traceback

# Fix sys.path to allow importing backend as a package
# Get the directory containing backend/ (project root)
script_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(script_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

# Import backend package FIRST to trigger __init__.py and load environment variables
import backend

# Use absolute import through backend package to ensure __init__.py executes
from backend.graph_core import build_graph_data_pure


def main():
    """Run the graph data construction and profile it."""
    print("=" * 60)
    print("Graph Data Construction Profiler")
    print("=" * 60)
    print()
    
    start_time = time.time()
    
    try:
        print("Calling build_graph_data_pure()...")
        result = build_graph_data_pure()
        
        end_time = time.time()
        runtime = end_time - start_time
        
        # Extract statistics
        nodes = result.get("nodes", [])
        links = result.get("links", [])
        
        num_nodes = len(nodes)
        num_links = len(links)
        
        # Count node types
        researcher_nodes = sum(1 for n in nodes if n.get("type") == "researcher")
        lab_nodes = sum(1 for n in nodes if n.get("type") == "lab")
        
        # Count link types
        paper_links = sum(1 for l in links if l.get("type") == "paper")
        advisor_links = sum(1 for l in links if l.get("type") == "advisor")
        
        print("✓ Graph data construction completed successfully")
        print()
        print("-" * 60)
        print("RESULTS:")
        print("-" * 60)
        print(f"Total runtime:     {runtime:.3f} seconds")
        print(f"Number of nodes:  {num_nodes}")
        print(f"  - Researchers:  {researcher_nodes}")
        print(f"  - Labs:         {lab_nodes}")
        print(f"Number of links:  {num_links}")
        print(f"  - Paper edges:  {paper_links}")
        print(f"  - Advisor edges: {advisor_links}")
        print("-" * 60)
        
    except Exception as e:
        end_time = time.time()
        runtime = end_time - start_time
        
        print("✗ Error occurred during graph data construction")
        print()
        print("-" * 60)
        print("ERROR DETAILS:")
        print("-" * 60)
        print(f"Runtime before error: {runtime:.3f} seconds")
        print(f"Exception type: {type(e).__name__}")
        print(f"Exception message: {str(e)}")
        print()
        print("Full traceback:")
        print("-" * 60)
        traceback.print_exc()
        print("-" * 60)


if __name__ == "__main__":
    main()

