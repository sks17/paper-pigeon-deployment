"""
Bedrock service for RAG operations.
"""
import os
import json
import boto3


def _get_bedrock_client():
    """
    Lazy-load Bedrock client to avoid AWS connections at import time.
    """
    return boto3.client(
        "bedrock-agent-runtime",
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
        region_name=os.getenv("AWS_REGION")
    )


def rag_chat(query, document_id):
    """
    Perform RAG chat using Bedrock RetrieveAndGenerate.
    
    Args:
        query: The user's question
        document_id: The document ID to filter on
        
    Returns:
        dict with "answer" and "citations" keys
    """
    client = _get_bedrock_client()
    
    knowledge_base_id = os.getenv("VITE_BEDROCK_KNOWLEDGE_BASE_ID")
    data_source_id = os.getenv("VITE_BEDROCK_DATA_SOURCE_ID")
    
    response = client.retrieve_and_generate(
        input={"text": query},
        retrieveAndGenerateConfiguration={
            "type": "KNOWLEDGE_BASE",
            "knowledgeBaseConfiguration": {
                "knowledgeBaseId": knowledge_base_id,
                "dataSourceIds": [data_source_id],
                "retrievalConfiguration": {
                    "vectorSearchConfiguration": {
                        "filter": {
                            "equals": {
                                "key": "document_id",
                                "value": document_id
                            }
                        }
                    }
                }
            }
        }
    )
    
    answer = response.get("output", {}).get("text", "No answer generated")
    citations = response.get("citations", [])
    
    return {
        "answer": answer,
        "citations": citations
    }


def rag_recommend(resume_text):
    """
    Recommend researchers based on resume text using Bedrock RAG.
    
    Args:
        resume_text: The parsed resume text
        
    Returns:
        dict with "recommendations" key containing list of recommendations
    """
    client = _get_bedrock_client()
    
    knowledge_base_id_2 = os.getenv("VITE_BEDROCK_KNOWLEDGE_BASE_ID_2")
    region = os.getenv("AWS_REGION")
    
    response = client.retrieve_and_generate(
        input={"text": resume_text},
        retrieveAndGenerateConfiguration={
            "type": "KNOWLEDGE_BASE",
            "knowledgeBaseConfiguration": {
                "knowledgeBaseId": knowledge_base_id_2,
                "modelArn": f"arn:aws:bedrock:{region}::foundation-model/meta.llama3-1-70b-instruct-v1:0",
                "retrievalConfiguration": {
                    "vectorSearchConfiguration": {
                        "numberOfResults": 25,
                        "overrideSearchType": "HYBRID",
                    }
                }
            }
        }
    )
    
    output_text = response.get("output", {}).get("text", "")
    
    try:
        parsed = json.loads(output_text)
        recommendations = parsed.get("recommendations", [])
        return {"recommendations": recommendations}
    except (json.JSONDecodeError, ValueError, KeyError):
        return {"recommendations": []}

