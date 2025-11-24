#!/usr/bin/env python3
"""
Standalone script to rebuild the graph cache.

INTEGRATION INSTRUCTIONS
========================

1. Manual Execution:
   From project root:
     python backend/tools/rebuild_graph_cache.py
   
   Or from backend directory:
     python tools/rebuild_graph_cache.py

2. Systemd Timer (Linux):
   Create /etc/systemd/system/rebuild-graph-cache.service:
     [Unit]
     Description=Rebuild Paper Pigeon Graph Cache
     After=network.target
     
     [Service]
     Type=oneshot
     User=your-user
     WorkingDirectory=/path/to/paper-pigeon
     ExecStart=/usr/bin/python3 backend/tools/rebuild_graph_cache.py
     Environment="PATH=/usr/bin:/usr/local/bin"
   
   Create /etc/systemd/system/rebuild-graph-cache.timer:
     [Unit]
     Description=Rebuild Graph Cache Timer
     Requires=rebuild-graph-cache.service
     
     [Timer]
     OnCalendar=daily
     # Or: OnCalendar=*-*-* 02:00:00  (2 AM daily)
     
     [Install]
     WantedBy=timers.target
   
   Enable and start:
     sudo systemctl enable rebuild-graph-cache.timer
     sudo systemctl start rebuild-graph-cache.timer

3. Cron (Unix/Linux/Mac):
   Add to crontab (crontab -e):
     # Rebuild graph cache daily at 2 AM
     0 2 * * * cd /path/to/paper-pigeon && /usr/bin/python3 backend/tools/rebuild_graph_cache.py >> /dev/null 2>&1
   
   Or with logging:
     0 2 * * * cd /path/to/paper-pigeon && /usr/bin/python3 backend/tools/rebuild_graph_cache.py

4. Trigger on Database Updates:
   Modify should_rebuild() function at bottom of this script to check:
     - Last modified timestamp of DynamoDB tables
     - S3 bucket modification times
     - Database change logs
     - Webhook triggers from your data pipeline

5. Windows Task Scheduler:
   - Create a new task
   - Trigger: Daily at 2:00 AM
   - Action: Start a program
   - Program: python.exe
   - Arguments: backend/tools/rebuild_graph_cache.py
   - Start in: C:\\path\\to\\paper-pigeon

REQUIREMENTS
============
- Python 3.12+
- boto3
- python-dotenv
- All AWS credentials in backend/.env
"""
import sys
import os
import json
import time
import logging
from datetime import datetime
from pathlib import Path
from logging.handlers import RotatingFileHandler
from typing import Dict, Any, Optional

# Fix sys.path to allow importing backend as a package
script_dir = Path(__file__).parent.absolute()
backend_dir = script_dir.parent
project_root = backend_dir.parent

if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

# Load environment variables FIRST using absolute path
from dotenv import load_dotenv
env_path = backend_dir / ".env"
if env_path.exists():
    load_dotenv(env_path, override=True)
else:
    print(f"WARNING: .env file not found at {env_path}", file=sys.stderr)

# Import backend package to trigger __init__.py (additional env loading)
import backend

# Import ONLY the pure graph building function (no Flask)
from backend.graph_core import build_graph_data_pure

# ============================================================================
# LOGGING SETUP
# ============================================================================

def setup_logging():
    """Configure rotating file logger."""
    logs_dir = script_dir / "logs"
    logs_dir.mkdir(exist_ok=True)
    
    log_file = logs_dir / "rebuilder.log"
    
    # Create logger
    logger = logging.getLogger("graph_cache_rebuilder")
    logger.setLevel(logging.INFO)
    
    # Remove existing handlers
    logger.handlers.clear()
    
    # Create rotating file handler
    handler = RotatingFileHandler(
        log_file,
        maxBytes=1024 * 1024,  # 1MB
        backupCount=5,
        encoding='utf-8'
    )
    
    # Create formatter
    formatter = logging.Formatter(
        '%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    handler.setFormatter(formatter)
    
    logger.addHandler(handler)
    
    # Also log to console
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    return logger

logger = setup_logging()

# ============================================================================
# RETRY LOGIC FOR DYNAMODB CALLS
# ============================================================================

def retry_dynamodb_call(func, max_retries=3, base_delay=1.0):
    """
    Retry wrapper for DynamoDB calls with exponential backoff.
    
    Args:
        func: Function to retry (must be callable with no args)
        max_retries: Maximum number of retry attempts
        base_delay: Base delay in seconds (will be doubled each retry)
    
    Returns:
        Result of func()
    
    Raises:
        Last exception if all retries fail
    """
    last_exception = None
    
    for attempt in range(max_retries + 1):
        try:
            return func()
        except Exception as e:
            last_exception = e
            if attempt < max_retries:
                delay = base_delay * (2 ** attempt)
                logger.warning(
                    f"DynamoDB call failed (attempt {attempt + 1}/{max_retries + 1}): {e}. "
                    f"Retrying in {delay}s..."
                )
                time.sleep(delay)
            else:
                logger.error(f"DynamoDB call failed after {max_retries + 1} attempts: {e}")
    
    raise last_exception

# ============================================================================
# GRAPH BUILDING WITH RETRY
# ============================================================================

def build_graph_with_retry():
    """
    Build graph data with retry logic for DynamoDB calls.
    Wraps build_graph_data_pure() to add resilience.
    """
    # The retry logic is handled at the DynamoDB service level
    # If individual calls fail, they will be retried automatically
    # For now, we wrap the entire build in a retry
    return retry_dynamodb_call(
        lambda: build_graph_data_pure(),
        max_retries=3,
        base_delay=1.0
    )

# ============================================================================
# ATOMIC FILE WRITING
# ============================================================================

def write_cache_atomic(graph_data: Dict[str, Any], cache_path: Path) -> bool:
    """
    Write cache file atomically using temporary file + os.replace.
    
    Args:
        graph_data: Graph data dictionary
        cache_path: Path to final cache file
    
    Returns:
        True if successful, False otherwise
    """
    try:
        # Ensure cache directory exists
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Create temporary file path
        temp_path = cache_path.parent / "graph_cache.tmp"
        
        # Write to temporary file
        logger.info(f"Writing cache to temporary file: {temp_path}")
        with open(temp_path, 'w', encoding='utf-8') as f:
            json.dump(graph_data, f, indent=2, default=str, ensure_ascii=False)
        
        # Atomic replace
        logger.info(f"Atomically replacing cache file: {cache_path}")
        os.replace(str(temp_path), str(cache_path))
        
        logger.info(f"Cache file written successfully: {cache_path}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to write cache file: {e}")
        # Clean up temp file if it exists
        temp_path = cache_path.parent / "graph_cache.tmp"
        if temp_path.exists():
            try:
                temp_path.unlink()
            except:
                pass
        return False

# ============================================================================
# CUSTOMIZATION HOOKS (Modify these functions as needed)
# ============================================================================

def on_before_rebuild() -> bool:
    """
    Called before starting the rebuild process.
    
    Returns:
        True to proceed with rebuild, False to skip
    """
    logger.info("on_before_rebuild() hook called")
    return True

def on_after_rebuild(graph_data: Dict[str, Any], duration: float) -> None:
    """
    Called after successful rebuild.
    
    Args:
        graph_data: The built graph data
        duration: Time taken in seconds
    """
    logger.info(f"on_after_rebuild() hook called (duration: {duration:.2f}s)")

def should_rebuild() -> bool:
    """
    Determine if rebuild should proceed.
    
    Add custom logic here, e.g.:
    - Check if DynamoDB tables were modified recently
    - Check S3 bucket modification times
    - Check database change logs
    - Return False to skip rebuild
    
    Returns:
        True to proceed with rebuild, False to skip
    """
    # Default: always rebuild
    # TODO: Add logic to check if database changed recently
    # Example:
    #   last_modified = get_last_dynamodb_modification_time()
    #   cache_age = get_cache_file_age()
    #   return cache_age > last_modified
    
    return True

def notify_success(nodes: int, links: int, duration: float) -> None:
    """
    Called on successful rebuild completion.
    
    Args:
        nodes: Number of nodes in graph
        links: Number of links in graph
        duration: Time taken in seconds
    """
    logger.info(f"notify_success() hook called: {nodes} nodes, {links} links in {duration:.2f}s")
    # TODO: Add notification logic (email, Slack, webhook, etc.)
    # Example:
    #   send_email("Graph cache rebuilt successfully")
    #   send_slack_message(f"✅ Graph cache rebuilt: {nodes} nodes, {links} links")

def notify_failure(error: Exception, duration: float) -> None:
    """
    Called on rebuild failure.
    
    Args:
        error: The exception that occurred
        duration: Time taken before failure
    """
    logger.error(f"notify_failure() hook called: {error} (duration: {duration:.2f}s)")
    # TODO: Add notification logic (email, Slack, webhook, etc.)
    # Example:
    #   send_email(f"Graph cache rebuild failed: {error}")
    #   send_slack_message(f"❌ Graph cache rebuild failed: {error}")

# ============================================================================
# MAIN REBUILD FUNCTION
# ============================================================================

def rebuild_cache() -> int:
    """
    Main function to rebuild the graph cache.
    
    Returns:
        0 on success, 1 on failure
    """
    start_time = time.time()
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    logger.info("=" * 60)
    logger.info(f"Starting cache rebuild at {timestamp}")
    logger.info("=" * 60)
    
    try:
        # Check if rebuild should proceed
        if not should_rebuild():
            logger.info("Rebuild skipped by should_rebuild() hook")
            return 0
        
        # Pre-rebuild hook
        if not on_before_rebuild():
            logger.info("Rebuild cancelled by on_before_rebuild() hook")
            return 0
        
        # Build graph data with retry logic
        logger.info("Building graph data from DynamoDB...")
        graph_data = build_graph_with_retry()
        
        build_time = time.time()
        build_duration = build_time - start_time
        
        nodes = graph_data.get("nodes", [])
        links = graph_data.get("links", [])
        node_count = len(nodes)
        link_count = len(links)
        
        logger.info(f"Graph built in {build_duration:.2f} seconds")
        logger.info(f"  Nodes: {node_count}")
        logger.info(f"  Links: {link_count}")
        
        # Write cache atomically
        cache_path = backend_dir / "cache" / "graph_cache.json"
        logger.info(f"Writing cache to: {cache_path}")
        
        write_start = time.time()
        if not write_cache_atomic(graph_data, cache_path):
            raise Exception("Failed to write cache file")
        
        write_duration = time.time() - write_start
        total_duration = time.time() - start_time
        
        logger.info(f"Cache written in {write_duration:.2f} seconds")
        logger.info(f"Total time: {total_duration:.2f} seconds")
        logger.info("=" * 60)
        logger.info("✅ Cache rebuild completed successfully")
        logger.info("=" * 60)
        
        # Post-rebuild hook
        on_after_rebuild(graph_data, total_duration)
        
        # Success notification
        notify_success(node_count, link_count, total_duration)
        
        return 0
        
    except MemoryError as e:
        total_duration = time.time() - start_time
        logger.error("=" * 60)
        logger.error(f"MemoryError during cache rebuild: {e}")
        logger.error(f"Runtime before error: {total_duration:.2f} seconds")
        logger.error("=" * 60)
        notify_failure(e, total_duration)
        return 1
        
    except Exception as e:
        total_duration = time.time() - start_time
        logger.error("=" * 60)
        logger.error(f"Error during cache rebuild: {e}")
        logger.error(f"Runtime before error: {total_duration:.2f} seconds")
        logger.error("=" * 60)
        import traceback
        logger.error("Full traceback:")
        logger.error(traceback.format_exc())
        logger.error("=" * 60)
        notify_failure(e, total_duration)
        return 1

# ============================================================================
# ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    exit_code = rebuild_cache()
    sys.exit(exit_code)

