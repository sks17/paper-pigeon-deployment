#!/usr/bin/env python3
"""
Upload graph cache to S3.

This script uploads the locally built graph cache to S3 for Lambda deployment.

Environment Variables Required:
- S3_BUCKET_NAME: S3 bucket to upload to
- CACHE_KEY: S3 key for the cache file (optional, defaults to 'graph_cache.json')
- AWS_ACCESS_KEY_ID: AWS access key (or use AWS credentials file)
- AWS_SECRET_ACCESS_KEY: AWS secret key (or use AWS credentials file)
- AWS_REGION: AWS region (optional, defaults to us-east-1)
"""
import boto3
import json
import os
import sys
from pathlib import Path

def main():
    """Upload graph cache to S3."""
    # Get environment variables
    bucket = os.environ.get('S3_BUCKET_NAME')
    cache_key = os.environ.get('CACHE_KEY', 'graph_cache.json')
    aws_region = os.environ.get('AWS_REGION', 'us-east-1')
    
    if not bucket:
        print("ERROR: S3_BUCKET_NAME environment variable not set", file=sys.stderr)
        print("Set it with: export S3_BUCKET_NAME=your-bucket-name", file=sys.stderr)
        sys.exit(1)
    
    # Get cache file path (relative to project root)
    script_dir = Path(__file__).parent.absolute()
    project_root = script_dir
    cache_path = project_root / "backend" / "cache" / "graph_cache.json"
    
    if not cache_path.exists():
        print(f"ERROR: Cache file not found at {cache_path}", file=sys.stderr)
        print("Please run 'python backend/tools/rebuild_graph_cache.py' first", file=sys.stderr)
        sys.exit(1)
    
    # Get file size for progress indication
    file_size = cache_path.stat().st_size
    file_size_mb = file_size / (1024 * 1024)
    
    print(f"Uploading {cache_path} → s3://{bucket}/{cache_key}")
    print(f"File size: {file_size_mb:.2f} MB")
    
    try:
        # Initialize S3 client
        s3 = boto3.client('s3', region_name=aws_region)
        
        # Upload file
        s3.upload_file(str(cache_path), bucket, cache_key)
        
        print("✅ Upload complete.")
        print(f"Cache is now available at: s3://{bucket}/{cache_key}")
        
        return 0
        
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    exit_code = main()
    sys.exit(exit_code)

