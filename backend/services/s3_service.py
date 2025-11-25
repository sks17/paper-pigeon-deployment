"""
S3 service for PDF presigned URL generation.
"""
import os
import boto3


def _env(*names: str):
    """Return the first non-empty environment variable from the list of names."""
    for name in names:
        value = os.getenv(name)
        if value:
            return value
    return None


def get_presigned_pdf_url(lab_id, document_id):
    """
    Generate a presigned URL for a PDF document in S3.
    
    Args:
        lab_id: The lab ID
        document_id: The document ID (without .pdf extension)
        
    Returns:
        dict with "url" key containing the presigned URL
    """
    s3 = boto3.client(
        "s3",
        region_name=_env("AWS_REGION", "VITE_AWS_REGION")
    )
    
    bucket = _env("S3_BUCKET_NAME", "VITE_S3_BUCKET_NAME")
    key = f"{lab_id}/{document_id}.pdf"
    
    presigned_url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=3600
    )
    
    return {"url": presigned_url}

