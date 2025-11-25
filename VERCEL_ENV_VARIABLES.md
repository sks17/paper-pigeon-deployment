# Vercel Environment Variables

This document lists all environment variables required for Paper Pigeon on Vercel.

## Currently Configured Variables

| Variable | Scope | Used By | Description |
|----------|-------|---------|-------------|
| `VITE_API_URL` | All Environments | Frontend | Base URL for API calls (e.g., `https://paper-pigeon.vercel.app`) |
| `AWS_ACCESS_KEY_ID` | All Environments | Backend (Bedrock, DynamoDB, S3) | AWS IAM access key |
| `AWS_SECRET_ACCESS_KEY` | All Environments | Backend (Bedrock, DynamoDB, S3) | AWS IAM secret key |
| `AWS_REGION` | All Environments | Backend (Bedrock, DynamoDB) | AWS region for Bedrock and DynamoDB |
| `S3_REGION` | All Environments | Backend (S3) | AWS region for S3 bucket |
| `S3_BUCKET_NAME` | All Environments | Backend (S3) | S3 bucket containing PDF files |
| `BEDROCK_KNOWLEDGE_BASE_ID` | All Environments | Backend (RAG Chat) | Primary Bedrock knowledge base for paper chat |
| `BEDROCK_DATA_SOURCE_ID` | All Environments | Backend (RAG Chat) | Data source ID for primary knowledge base |
| `BEDROCK_KNOWLEDGE_BASE_ID_2` | All Environments | Backend (Recommendations) | Secondary knowledge base for resume recommendations |
| `BEDROCK_DATA_SOURCE_ID_2` | All Environments | Backend (Recommendations) | Data source ID for secondary knowledge base |

## Variable Usage by Service

### Frontend (`src/`)
- `VITE_API_URL` - Used in all `fetch()` calls to construct API endpoints

### Bedrock Service (`backend/services/bedrock_service.py`)
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `BEDROCK_KNOWLEDGE_BASE_ID`
- `BEDROCK_DATA_SOURCE_ID`
- `BEDROCK_KNOWLEDGE_BASE_ID_2`
- `BEDROCK_DATA_SOURCE_ID_2`

### DynamoDB Service (`backend/services/dynamodb_service.py`)
- `AWS_REGION`
- (Uses default credential chain for access keys)

### S3 Service (`backend/services/s3_service.py`)
- `S3_REGION`
- `S3_BUCKET_NAME`
- (Uses default credential chain for access keys)

## Notes

1. **No `VITE_` prefix needed for backend variables** - The backend services read environment variables directly without the `VITE_` prefix.

2. **S3 has its own region** - `S3_REGION` is separate from `AWS_REGION` to allow the S3 bucket to be in a different region than Bedrock/DynamoDB.

3. **Credential chain** - For DynamoDB and S3, boto3 uses the AWS default credential chain, which picks up `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` automatically.

