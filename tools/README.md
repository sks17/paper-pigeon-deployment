# Tools Directory

Utility scripts for managing the graph cache.

## upload_cache.py

Uploads the locally built graph cache to S3.

### Prerequisites

1. Build the cache locally:
   ```bash
   python backend/build_graph_cache.py
   ```

2. Ensure the cache file exists:
   ```bash
   ls backend/cache/graph_cache.json
   ```

### Environment Variables

**Required:**
- `S3_BUCKET_NAME`: S3 bucket to upload to

**Optional:**
- `CACHE_KEY`: S3 key for the cache file (defaults to `graph_cache.json`)
- `AWS_REGION`: AWS region (defaults to `us-east-1`)
- `AWS_ACCESS_KEY_ID`: AWS access key (or use AWS credentials file)
- `AWS_SECRET_ACCESS_KEY`: AWS secret key (or use AWS credentials file)

### Usage

**Using environment variables:**
```bash
export AWS_ACCESS_KEY_ID=your-access-key
export AWS_SECRET_ACCESS_KEY=your-secret-key
export S3_BUCKET_NAME=your-bucket-name
python tools/upload_cache.py
```

**Using AWS credentials file:**
If you have `~/.aws/credentials` configured:
```bash
export S3_BUCKET_NAME=your-bucket-name
python tools/upload_cache.py
```

**With custom cache key:**
```bash
export S3_BUCKET_NAME=your-bucket-name
export CACHE_KEY=production/graph_cache.json
python tools/upload_cache.py
```

### Example Output

```
Uploading backend/cache/graph_cache.json → s3://paper-pigeon-cache/graph_cache.json
File size: 2.45 MB
✅ Upload complete.
Cache is now available at: s3://paper-pigeon-cache/graph_cache.json
```

### Error Handling

The script will exit with an error if:
- `S3_BUCKET_NAME` is not set
- Cache file doesn't exist (run build script first)
- S3 upload fails (check credentials and permissions)
- AWS credentials are invalid

### Automation

Combine with cache rebuild for automated updates:

```bash
# Rebuild and upload in one command
python backend/build_graph_cache.py && python tools/upload_cache.py
```

### IAM Permissions Required

The AWS credentials need S3 PutObject permission:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject"],
      "Resource": "arn:aws:s3:::YOUR_BUCKET_NAME/*"
    }
  ]
}
```

## Notes

- This script is primarily useful for deploying cache updates to S3 for Lambda-based deployments
- For Vercel deployments, the cache is included directly in the serverless function via `vercel.json` configuration
- The `public/graph_cache.json` file is the primary source for Vercel deployments
