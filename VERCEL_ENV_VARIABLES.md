# Vercel Environment Variables

This document lists all environment variables required for Paper Pigeon on Vercel.

## Required Variables

| Variable | Scope | Used By | Description |
|----------|-------|---------|-------------|
| `AWS_ACCESS_KEY_ID` | All Environments | Backend (Bedrock, DynamoDB, S3) | AWS IAM access key |
| `AWS_SECRET_ACCESS_KEY` | All Environments | Backend (Bedrock, DynamoDB, S3) | AWS IAM secret key |
| `AWS_REGION` | All Environments | Backend (Bedrock, DynamoDB, S3) | AWS region (e.g., `us-west-2`) |
| `S3_BUCKET_NAME` | All Environments | Backend (S3) | S3 bucket containing PDF files |
| `BEDROCK_KNOWLEDGE_BASE_ID` | All Environments | Backend (RAG Chat) | Primary Bedrock knowledge base for paper chat |
| `BEDROCK_KNOWLEDGE_BASE_ID_2` | All Environments | Backend (Recommendations) | Secondary knowledge base for resume recommendations |

## Optional Variables

| Variable | Scope | Used By | Description |
|----------|-------|---------|-------------|
| `BEDROCK_DATA_SOURCE_ID` | All Environments | Backend (RAG Chat) | Data source ID for primary knowledge base |
| `S3_REGION` | All Environments | Backend (S3) | Separate region for S3 (defaults to `AWS_REGION`) |
| `NODE_ENV` | All Environments | Backend (Diagnostics) | Set to `production` to disable diagnostic logging |

## Variable Usage by Service

### Bedrock Service (`backend/services/bedrock_service.py`)

- `AWS_ACCESS_KEY_ID` (with fallback to `VITE_AWS_ACCESS_KEY_ID`)
- `AWS_SECRET_ACCESS_KEY` (with fallback to `VITE_AWS_SECRET_ACCESS_KEY`)
- `AWS_REGION` (with fallback to `VITE_AWS_REGION`)
- `BEDROCK_KNOWLEDGE_BASE_ID` (with fallback to `VITE_BEDROCK_KNOWLEDGE_BASE_ID`)
- `BEDROCK_KNOWLEDGE_BASE_ID_2` (with fallback to `VITE_BEDROCK_KNOWLEDGE_BASE_ID_2`)

### DynamoDB Service (`backend/services/dynamodb_service.py`)

- `AWS_REGION` (uses boto3 default credential chain for access keys)

### S3 Service (`backend/services/s3_service.py`)

- `AWS_REGION`
- `S3_BUCKET_NAME`

### Frontend

No environment variables required. All API calls use relative URLs (e.g., `/api/graph/data`).

## Notes

1. **No `VITE_` prefix needed for backend variables** - The backend services read environment variables directly. The `VITE_` fallbacks exist for backwards compatibility.

2. **Credential chain** - For DynamoDB and S3, boto3 uses the AWS default credential chain, which picks up `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` automatically.

3. **Diagnostic logging** - Set `NODE_ENV=production` to disable verbose diagnostic logging in the backend.

## Setting Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable with appropriate scope (Production, Preview, Development)
4. Redeploy for changes to take effect
