"""
S3 service for PDF presigned URL generation.
"""
import os
import boto3


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
        region_name=os.getenv("AWS_REGION")
    )
    
    bucket = os.getenv("S3_BUCKET_NAME")
    key = f"{lab_id}/{document_id}.pdf"
    
    presigned_url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=3600
    )
    
    return {"url": presigned_url}

