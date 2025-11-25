import os
import boto3
from boto3.dynamodb.conditions import Attr

# In-memory cache for DynamoDB reads
CACHE_RESEARCHERS = {}
CACHE_PAPERS = {}
CACHE_LIBRARY_ENTRIES = {}


def _env(*names: str):
    """Return the first non-empty environment variable from the list of names."""
    for name in names:
        value = os.getenv(name)
        if value:
            return value
    return None


def get_dynamodb():
    """
    Get DynamoDB resource. Called lazily to avoid AWS connections at import time.
    """
    aws_region = _env("AWS_REGION", "VITE_AWS_REGION")
    return boto3.resource(
        "dynamodb",
        region_name=aws_region
    )


def fetch_researchers():
    """
    Fetch all researchers.
    Mirrors DynamoDBService.fetchResearchers() in frontend.
    """
    print("CALL: fetch_researchers")
    
    # Check if cache is populated (if any researcher is cached, assume all are)
    if CACHE_RESEARCHERS:
        print("RETURN: fetch_researchers (cached)", len(CACHE_RESEARCHERS))
        return list(CACHE_RESEARCHERS.values())
    
    # Fetch from DynamoDB
    dynamodb = get_dynamodb()
    table = dynamodb.Table("researchers")
    response = table.scan()
    result = response.get("Items", [])
    
    # Cache all researchers by researcher_id
    for researcher in result:
        researcher_id = researcher.get("researcher_id")
        if researcher_id:
            CACHE_RESEARCHERS[researcher_id] = researcher
    
    print("RETURN: fetch_researchers", len(result))
    return result


def fetch_paper_edges():
    """
    Fetch all paper edges.
    """
    print("CALL: fetch_paper_edges")
    dynamodb = get_dynamodb()
    table = dynamodb.Table("paper-edges")
    response = table.scan()
    result = response.get("Items", [])
    print("RETURN: fetch_paper_edges", len(result))
    return result


def fetch_advisor_edges():
    """
    Fetch all advisor edges.
    """
    print("CALL: fetch_advisor_edges")
    dynamodb = get_dynamodb()
    table = dynamodb.Table("advisor_edges")
    response = table.scan()
    result = response.get("Items", [])
    print("RETURN: fetch_advisor_edges", len(result))
    return result


def fetch_library_entries(researcher_id):
    """
    Fetch library entries matching researcher_id.
    Mirrors frontend: Scan + FilterExpression.
    """
    print("CALL: fetch_library_entries")
    
    # Check cache first
    if researcher_id in CACHE_LIBRARY_ENTRIES:
        result = CACHE_LIBRARY_ENTRIES[researcher_id]
        print("RETURN: fetch_library_entries (cached)", len(result) if result else 0)
        return result
    
    # Fetch from DynamoDB
    dynamodb = get_dynamodb()
    table = dynamodb.Table("library")
    response = table.scan(
        FilterExpression=Attr("researcher_id").eq(researcher_id)
    )
    result = response.get("Items", [])
    
    # Cache the result (even if empty list)
    CACHE_LIBRARY_ENTRIES[researcher_id] = result
    
    print("RETURN: fetch_library_entries", len(result))
    return result


def _batch_get(table_name, key_name, key_values):
    """
    Helper to batch-get items from DynamoDB respecting the 100 key limit.
    """
    print("BATCH KEYS:", len(key_values))
    if not key_values:
        return []

    dynamodb = get_dynamodb()
    all_results = []

    # Process in chunks of <= 100
    for i in range(0, len(key_values), 100):
        chunk = key_values[i:i + 100]

        response = dynamodb.meta.client.batch_get_item(
            RequestItems={
                table_name: {
                    "Keys": [{key_name: v} for v in chunk]
                }
            }
        )

        items = response.get("Responses", {}).get(table_name, [])
        all_results.extend(items)

    return all_results


def fetch_papers(document_ids):
    print("CALL: fetch_papers")
    
    if not document_ids:
        print("RETURN: fetch_papers 0")
        return []
    
    # Check cache for each document_id
    cached_papers = []
    uncached_ids = []
    
    for doc_id in document_ids:
        if doc_id in CACHE_PAPERS:
            cached_papers.append(CACHE_PAPERS[doc_id])
        else:
            uncached_ids.append(doc_id)
    
    # Fetch uncached papers from DynamoDB
    if uncached_ids:
        fetched_papers = _batch_get("papers", "document_id", uncached_ids)
        # Cache the fetched papers
        for paper in fetched_papers:
            doc_id = paper.get("document_id")
            if doc_id:
                CACHE_PAPERS[doc_id] = paper
        cached_papers.extend(fetched_papers)
    
    result = cached_papers
    print("RETURN: fetch_papers", len(result))
    return result


def fetch_lab_info(lab_ids):
    return _batch_get("lab-info", "lab_id", lab_ids)


def fetch_descriptions(researcher_ids):
    print("CALL: fetch_descriptions")
    result = _batch_get("descriptions", "researcher_id", researcher_ids)
    print("RETURN: fetch_descriptions", len(result))
    return result


def fetch_metrics(researcher_ids):
    print("CALL: fetch_metrics")
    result = _batch_get("metrics", "researcher_id", researcher_ids)
    print("RETURN: fetch_metrics", len(result))
    return result

