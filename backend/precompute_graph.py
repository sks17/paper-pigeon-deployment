"""
Precompute graph data and upload to S3.

This script:
1. Loads environment variables from .env
2. Calls build_graph_data() to construct the full graph
3. Writes the result to a temporary file
4. Uploads to S3 at key "graph.json"
5. Prints timing and success/failure

Runnable from project root:
    python backend/precompute_graph.py
"""
import sys
import os
import json
import time
import tempfile
import traceback
import boto3

# Fix sys.path to allow importing backend as a package
# Get the directory containing backend/ (project root)
script_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(script_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

# Import backend package FIRST to trigger __init__.py and load environment variables
import backend

# Use absolute import through backend package
from backend.graph_core import build_graph_data_pure


def main():
    """Precompute graph data and upload to S3."""
    print("=" * 60)
    print("Graph Precomputation Script")
    print("=" * 60)
    print()
    
    # Check required environment variables
    bucket_name = os.getenv("S3_BUCKET_NAME")
    aws_region = os.getenv("AWS_REGION")
    
    if not bucket_name:
        print("ERROR: S3_BUCKET_NAME environment variable not set")
        print("Please set S3_BUCKET_NAME in your .env file")
        return 1
    
    if not aws_region:
        print("ERROR: AWS_REGION environment variable not set")
        print("Please set AWS_REGION in your .env file")
        return 1
    
    print(f"S3 Bucket: {bucket_name}")
    print(f"AWS Region: {aws_region}")
    print()
    
    start_time = time.time()
    
    try:
        # Build graph data
        print("Building graph data from DynamoDB...")
        print("-" * 60)
        graph_data = build_graph_data_pure()
        
        build_time = time.time()
        build_duration = build_time - start_time
        
        nodes = graph_data.get("nodes", [])
        links = graph_data.get("links", [])
        
        print("-" * 60)
        print(f"✓ Graph data built successfully in {build_duration:.3f} seconds")
        print(f"  Nodes: {len(nodes)}")
        print(f"  Links: {len(links)}")
        print()
        
        # Write to temporary file
        print("Writing graph data to temporary file...")
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as tmp_file:
            json.dump(graph_data, tmp_file, default=str, indent=2)
            tmp_path = tmp_file.name
        
        print(f"✓ Written to temporary file: {tmp_path}")
        print()
        
        # Upload to S3
        print("Uploading to S3...")
        upload_start = time.time()
        
        s3_client = boto3.client("s3", region_name=aws_region)
        
        with open(tmp_path, 'rb') as f:
            s3_client.put_object(
                Bucket=bucket_name,
                Key="graph.json",
                Body=f,
                ContentType="application/json"
            )
        
        upload_duration = time.time() - upload_start
        total_duration = time.time() - start_time
        
        print(f"✓ Uploaded to S3: s3://{bucket_name}/graph.json")
        print(f"  Upload time: {upload_duration:.3f} seconds")
        print()
        
        # Clean up temp file
        try:
            os.unlink(tmp_path)
            print(f"✓ Cleaned up temporary file")
        except Exception as e:
            print(f"WARNING: Failed to delete temp file {tmp_path}: {e}")
        
        print()
        print("=" * 60)
        print("SUCCESS")
        print("=" * 60)
        print(f"Total time: {total_duration:.3f} seconds")
        print(f"Graph data is now available at: s3://{bucket_name}/graph.json")
        print()
        print("To use the precomputed graph, set in your .env file:")
        print("  USE_PRECOMPUTED_GRAPH=true")
        print("=" * 60)
        
        return 0
        
    except Exception as e:
        total_duration = time.time() - start_time
        
        print()
        print("=" * 60)
        print("ERROR")
        print("=" * 60)
        print(f"Runtime before error: {total_duration:.3f} seconds")
        print(f"Exception type: {type(e).__name__}")
        print(f"Exception message: {str(e)}")
        print()
        print("Full traceback:")
        print("-" * 60)
        traceback.print_exc()
        print("-" * 60)
        
        return 1


if __name__ == "__main__":
    exit_code = main()
    sys.exit(exit_code)

