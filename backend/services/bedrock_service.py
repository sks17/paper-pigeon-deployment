"""
Bedrock service for RAG operations.
"""
import os
import json
import boto3
import time
import traceback


def _env(*names: str):
    """Return the first non-empty environment variable from the list of names."""
    for name in names:
        value = os.getenv(name)
        if value:
            return value
    return None


def _get_bedrock_client():
    """
    Lazy-load Bedrock client to avoid AWS connections at import time.
    """
    # DIAGNOSTICS: Check environment variables before client creation
    if os.getenv('NODE_ENV') != 'production':
        print("[RAG DIAG] _get_bedrock_client() called")
        print("[RAG DIAG] Checking required environment variables:")
        required_vars = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION"]
        for var in required_vars:
            value = os.getenv(var)
            exists = value is not None and value != ""
            print(f"[RAG DIAG]   {var}: {'SET' if exists else 'MISSING'} (length: {len(value) if value else 0})")
    
    aws_access_key = _env("AWS_ACCESS_KEY_ID", "VITE_AWS_ACCESS_KEY_ID")
    aws_secret_key = _env("AWS_SECRET_ACCESS_KEY", "VITE_AWS_SECRET_ACCESS_KEY")
    aws_region = _env("AWS_REGION", "VITE_AWS_REGION")
    
    # DIAGNOSTICS: Validate env vars before client creation
    if os.getenv('NODE_ENV') != 'production':
        if not aws_access_key:
            print("[RAG DIAG] ERROR: AWS_ACCESS_KEY_ID is None or empty")
        if not aws_secret_key:
            print("[RAG DIAG] ERROR: AWS_SECRET_ACCESS_KEY is None or empty")
        if not aws_region:
            print("[RAG DIAG] ERROR: AWS_REGION is None or empty")
    
    try:
        client = boto3.client(
            "bedrock-agent-runtime",
            aws_access_key_id=aws_access_key,
            aws_secret_access_key=aws_secret_key,
            region_name=aws_region
        )
        
        if os.getenv('NODE_ENV') != 'production':
            print("[RAG DIAG] Bedrock client created successfully")
            print(f"[RAG DIAG] Client region: {aws_region}")
        
        return client
    except Exception as e:
        if os.getenv('NODE_ENV') != 'production':
            print(f"[RAG DIAG] ERROR creating Bedrock client:")
            print(f"[RAG DIAG]   Error type: {type(e).__name__}")
            print(f"[RAG DIAG]   Error message: {str(e)}")
            print(f"[RAG DIAG]   Traceback:")
            print(traceback.format_exc())
        raise


def rag_chat(query, document_id):
    """
    Perform RAG chat using Bedrock RetrieveAndGenerate.
    
    Args:
        query: The user's question
        document_id: The document ID to filter on
        
    Returns:
        dict with "answer" and "citations" keys
    """
    start_time = time.time()
    
    # DIAGNOSTICS: Log function entry
    if os.getenv('NODE_ENV') != 'production':
        print(f"[RAG DIAG] rag_chat() called")
        print(f"[RAG DIAG]   query type: {type(query)}, length: {len(query) if query else 0}")
        print(f"[RAG DIAG]   document_id type: {type(document_id)}, value: {document_id}")
        print(f"[RAG DIAG]   query is None: {query is None}")
        print(f"[RAG DIAG]   document_id is None: {document_id is None}")
    
    
    # Step 1: Get Bedrock client
    client_start = time.time()
    try:
        client = _get_bedrock_client()
        client_duration = time.time() - client_start
        if os.getenv('NODE_ENV') != 'production':
            print(f"[RAG DIAG] Client creation took: {client_duration:.3f}s")
    except Exception as e:
        if os.getenv('NODE_ENV') != 'production':
            print(f"[RAG DIAG] ERROR: Failed to create Bedrock client")
            print(f"[RAG DIAG]   Error type: {type(e).__name__}")
            print(f"[RAG DIAG]   Error message: {str(e)}")
        raise
    
    # Step 2: Get knowledge base configuration
    knowledge_base_id = _env("BEDROCK_KNOWLEDGE_BASE_ID", "VITE_BEDROCK_KNOWLEDGE_BASE_ID")
    aws_region = _env("AWS_REGION", "VITE_AWS_REGION")
    
    if not knowledge_base_id:
        raise ValueError("BEDROCK_KNOWLEDGE_BASE_ID environment variable is not set")
    
    if not aws_region:
        raise ValueError("AWS_REGION environment variable is not set")
    
    # Step 3: Build request payload (matches working rag_recommend structure)
    request_payload = {
        "input": {"text": query},
        "retrieveAndGenerateConfiguration": {
            "type": "KNOWLEDGE_BASE",
            "knowledgeBaseConfiguration": {
                "knowledgeBaseId": knowledge_base_id,
                "modelArn": f"arn:aws:bedrock:{aws_region}::foundation-model/anthropic.claude-3-haiku-20240307-v1:0",
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
    }
    
    
    # Step 4: Call Bedrock API
    api_start = time.time()
    try:
        if os.getenv('NODE_ENV') != 'production':
            print(f"[RAG DIAG] Calling client.retrieve_and_generate()...")
        
        response = client.retrieve_and_generate(**request_payload)
        
        api_duration = time.time() - api_start
        if os.getenv('NODE_ENV') != 'production':
            print(f"[RAG DIAG] Bedrock API call completed in: {api_duration:.3f}s")
            print(f"[RAG DIAG] Response type: {type(response)}")
            print(f"[RAG DIAG] Response keys: {list(response.keys()) if isinstance(response, dict) else 'Not a dict'}")
    except Exception as e:
        api_duration = time.time() - api_start
        error_type = type(e).__name__
        error_message = str(e)
        
        if os.getenv('NODE_ENV') != 'production':
            print(f"[RAG DIAG] ERROR: Bedrock API call failed after {api_duration:.3f}s")
            print(f"[RAG DIAG]   Error type: {error_type}")
            print(f"[RAG DIAG]   Error message: {error_message}")
            print(f"[RAG DIAG]   Full traceback:")
            print(traceback.format_exc())
            print(f"[RAG DIAG]   Request payload that failed:")
            print(f"[RAG DIAG]     knowledgeBaseId: {knowledge_base_id}")
            print(f"[RAG DIAG]     dataSourceIds: {[data_source_id]}")
            print(f"[RAG DIAG]     filter document_id: {document_id}")
        
        raise
    
    # Step 5: Parse response
    parse_start = time.time()
    try:
        if os.getenv('NODE_ENV') != 'production':
            print(f"[RAG DIAG] Parsing response...")
            print(f"[RAG DIAG]   response.get('output'): {response.get('output')}")
            output_text = response.get('output', {}).get('text', 'KEY_NOT_FOUND')
            output_preview = output_text[:100] if output_text and output_text != 'KEY_NOT_FOUND' else 'None'
            print(f"[RAG DIAG]   response.get('output', {{}}).get('text'): {output_preview}")
            print(f"[RAG DIAG]   response.get('citations'): {response.get('citations')}")
        
        answer = response.get("output", {}).get("text", "No answer generated")
        citations = response.get("citations", [])
        
        if os.getenv('NODE_ENV') != 'production':
            print(f"[RAG DIAG] Parsed answer length: {len(answer) if answer else 0}")
            print(f"[RAG DIAG] Parsed citations count: {len(citations) if citations else 0}")
            print(f"[RAG DIAG] Citations type: {type(citations)}")
            if citations:
                print(f"[RAG DIAG] First citation keys: {list(citations[0].keys()) if isinstance(citations[0], dict) else 'Not a dict'}")
        
        result = {
            "answer": answer,
            "citations": citations
        }
        
        parse_duration = time.time() - parse_start
        total_duration = time.time() - start_time
        
        if os.getenv('NODE_ENV') != 'production':
            print(f"[RAG DIAG] Response parsing took: {parse_duration:.3f}s")
            print(f"[RAG DIAG] Total rag_chat() duration: {total_duration:.3f}s")
            print(f"[RAG DIAG] Returning result with keys: {list(result.keys())}")
        
        return result
        
    except Exception as e:
        parse_duration = time.time() - parse_start
        if os.getenv('NODE_ENV') != 'production':
            print(f"[RAG DIAG] ERROR: Failed to parse response after {parse_duration:.3f}s")
            print(f"[RAG DIAG]   Error type: {type(e).__name__}")
            print(f"[RAG DIAG]   Error message: {str(e)}")
            print(f"[RAG DIAG]   Response object: {response}")
            print(f"[RAG DIAG]   Full traceback:")
            print(traceback.format_exc())
        raise


def rag_recommend(resume_text):
    """
    Recommend researchers based on resume text using Bedrock RAG.
    
    Args:
        resume_text: The parsed resume text
        
    Returns:
        dict with "recommendations" key containing list of recommendations
    """
    client = _get_bedrock_client()
    
    knowledge_base_id_2 = _env("BEDROCK_KNOWLEDGE_BASE_ID_2", "VITE_BEDROCK_KNOWLEDGE_BASE_ID_2")
    region = _env("AWS_REGION", "VITE_AWS_REGION")
    
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

