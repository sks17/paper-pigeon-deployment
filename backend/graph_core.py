"""
Pure Python module for building graph data from DynamoDB.
Structured to match the exact frontend TypeScript schema for nodes and links.
"""

from services.dynamodb_service import (
    fetch_researchers,
    fetch_paper_edges,
    fetch_advisor_edges,
    fetch_library_entries,
    fetch_papers,
    fetch_descriptions,
    fetch_metrics
)

# Hardcoded labs (must match frontend `lab_id` → display name)
LAB_LIST = [
    ("aims_lab", "AIMS Lab"),
    ("behavioral_data_science_group", "Behavioral Data Science Group"),
    ("bespoke_silicon_group", "Bespoke Silicon Group"),
    ("database_group", "Database Group"),
    ("h2_lab", "H2 Lab"),
    ("human_centered_robotics_lab", "Human-Centered Robotics Lab"),
    ("ictd_lab", "ICTD Lab"),
    ("interactive_data_lab", "Interactive Data Lab"),
    ("make4all_group", "Make4all Group"),
    ("makeability_lab", "Makeability Lab"),
    ("molecular_information_systems_lab", "MISL"),
    ("mostafavi_lab", "Mostafavi Lab"),
    ("personal_robotics_lab", "Personal Robotics Lab"),
    ("raivn_lab", "RAIVN Lab"),
    ("robot_learning_lab", "Robot Learning Lab"),
    ("sampl", "SAMPL"),
    ("social_futures_lab", "Social Futures Lab"),
    ("social_rl_lab", "Social RL Lab"),
    ("snail_lab", "SNAIL"),
    ("theory_of_computation_group", "Theory of Computation Group"),
    ("tsvetshop", "Tsvetshop"),
    ("ubicomp_lab", "UbiComp Lab"),
    ("uw_reality_lab", "UW Reality Lab"),
    ("weird_lab", "WEIRD Lab"),
    ("wildlab", "Wildlab"),
]

LAB_NAME_TO_ID = {name: lab_id for lab_id, name in LAB_LIST}


def build_graph_data_pure():
    """
    Build graph data (nodes + links) matching the exact frontend expectations.
    Returns: dict with:
      - nodes: list of researcher + lab nodes
      - links: list of edges (paper, advisor, researcher_lab)
    """

    # --------------------------
    # Fetch all DynamoDB sources
    # --------------------------
    researchers = fetch_researchers()
    paper_edges = fetch_paper_edges()
    advisor_edges = fetch_advisor_edges()

    researcher_ids = [r["researcher_id"] for r in researchers]

    descriptions = fetch_descriptions(researcher_ids)
    metrics = fetch_metrics(researcher_ids)

    descriptions_map = {d["researcher_id"]: d.get("about", "") for d in descriptions}
    metrics_map = {m["researcher_id"]: m.get("influence") for m in metrics}

    # ---------
    # Build maps
    # ---------
    researcher_map = {r["researcher_id"]: r for r in researchers}

    # ------------------------
    # Build researcher nodes
    # ------------------------
    nodes = []
    for r in researchers:
        rid = r["researcher_id"]

        # Load library entries → papers
        library_entries = fetch_library_entries(rid)
        document_ids = [entry["document_id"] for entry in library_entries]
        papers = fetch_papers(document_ids)

        # Clean paper objects to match frontend expectations
        cleaned_papers = []
        for p in papers:
            cleaned_papers.append({
                "title": p.get("title"),
                "year": p.get("year"),
                "document_id": p.get("document_id"),
                "tags": p.get("tags", []),
            })

        # Extract sorted unique tags
        tags = sorted({tag for p in papers for tag in p.get("tags", [])})

        # Construct the researcher node
        node_obj = {
            "id": rid,
            "name": r.get("name", ""),
            "type": "researcher",
            "val": 1,

            # Optional details
            "advisor": r.get("advisor"),
            "contact_info": r.get("contact_info", []),
            "labs": r.get("labs", []),
            "standing": r.get("standing"),
            "papers": cleaned_papers,
            "tags": tags,
            "influence": metrics_map.get(rid),
            "about": descriptions_map.get(rid),
        }

        nodes.append(node_obj)

    # ------------------------
    # Build lab nodes (static)
    # ------------------------
    for lab_id, name in LAB_LIST:
        nodes.append({
            "id": lab_id,
            "name": name,
            "type": "lab",
            "val": 2,
        })

    # ------------------------
    # Build links
    # ------------------------
    links = []

    # Paper edges
    for e in paper_edges:
        a = e["researcher_one_id"]
        b = e["researcher_two_id"]
        if a in researcher_map and b in researcher_map:
            links.append({"source": a, "target": b, "type": "paper"})

    # Advisor edges
    for e in advisor_edges:
        a = e["advisee_id"]
        b = e["advisor_id"]
        if a in researcher_map and b in researcher_map:
            links.append({"source": a, "target": b, "type": "advisor"})

    # Researcher-Lab edges (previously missing)
    for r in researchers:
        rid = r["researcher_id"]
        labs = r.get("labs", [])
        for lab_name in labs:
            lab_id = LAB_NAME_TO_ID.get(lab_name)
            if lab_id:
                links.append({
                    "source": rid,
                    "target": lab_id,
                    "type": "researcher_lab",
                })

    # ------------------------
    # Final JSON object
    # ------------------------
    return {
        "nodes": nodes,
        "links": links,
    }
