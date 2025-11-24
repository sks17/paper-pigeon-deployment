"""
Minimal test script to verify AWS environment variable loading.
"""
from dotenv import load_dotenv
import os

print("=" * 60)
print("ENVIRONMENT VARIABLE DIAGNOSTIC TEST")
print("=" * 60)
print()

# Test 1: Load dotenv
print("STEP 1: Loading .env file...")
load_dotenv()
print("[OK] load_dotenv() called")

# Test 2: Check AWS variables
print("\nSTEP 2: Checking AWS environment variables...")
aws_region = os.getenv("AWS_REGION")
aws_access_key = os.getenv("AWS_ACCESS_KEY_ID")
aws_secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")

print(f"AWS_REGION: {aws_region if aws_region else 'NOT SET'}")
print(f"AWS_ACCESS_KEY_ID: {'SET' if aws_access_key else 'NOT SET'} ({'***' + aws_access_key[-4:] if aws_access_key and len(aws_access_key) > 4 else 'N/A'})")
print(f"AWS_SECRET_ACCESS_KEY: {'SET' if aws_secret_key else 'NOT SET'}")

# Test 3: Try lightweight boto3 call
print("\nSTEP 3: Testing boto3 connection...")
try:
    import boto3
    print("[OK] boto3 imported successfully")
    
    if aws_region:
        print(f"Creating STS client with region: {aws_region}")
        sts_client = boto3.client(
            "sts",
            region_name=aws_region,
            aws_access_key_id=aws_access_key,
            aws_secret_access_key=aws_secret_key
        )
        print("[OK] STS client created")
        
        identity = sts_client.get_caller_identity()
        print(f"[OK] AWS Identity verified: {identity.get('Arn', 'Unknown')}")
    else:
        print("[ERROR] AWS_REGION not set, skipping boto3 test")
        
except Exception as e:
    print(f"[ERROR] {type(e).__name__}: {str(e)}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
print("TEST COMPLETE")
print("=" * 60)

