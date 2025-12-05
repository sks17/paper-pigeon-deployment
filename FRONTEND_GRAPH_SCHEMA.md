# Frontend Graph Data Schema

This document provides a complete specification of the graph data structure expected by the frontend, including all TypeScript interfaces, node/link creation patterns, and rendering requirements.

---

## TypeScript Interfaces

### GraphData Interface

```typescript
// Location: src/services/dynamodb.ts
export interface GraphData {
  nodes: Node[];
  links: Link[];
}
```

### Node Interface

```typescript
export interface Node {
  id: string;                    // Required: unique identifier
  name: string;                  // Required: display name
  type: 'researcher' | 'lab';    // Required: node type discriminator
  val: number;                   // Required: rendering size (researcher=1, lab=2)
  
  // Researcher-specific fields (only present when type === 'researcher')
  advisor?: string;              // Optional: advisor name
  contact_info?: string[];       // Optional: array of contact strings
  labs?: string[];               // Optional: array of lab names
  standing?: string;             // Optional: "Professor", "PhD Student", etc.
  papers?: Paper[];              // Optional: array of paper objects
  tags?: string[];               // Optional: sorted research area tags
  influence?: number;            // Optional: influence score (0-100)
  about?: string;                // Optional: description text
}
```

### Link Interface

```typescript
export interface Link {
  source: string;               // Required: source node id
  target: string;               // Required: target node id
  type: string;                 // Required: 'paper' | 'advisor' | 'researcher_lab'
}
```

### Paper Interface

```typescript
export interface Paper {
  title: string;                // Required: paper title
  year: number;                 // Required: publication year
  document_id: string;          // Required: unique document identifier
  tags?: string[];              // Optional: array of tags
}
```

### Researcher Interface

```typescript
export interface Researcher {
  id: string;
  name: string;
  type: 'researcher';
  val: number;
  advisor?: string;
  contact_info?: string[];
  labs?: string[];
  standing?: string;
  papers?: Paper[];
  tags?: string[];
  influence?: number;
  about?: string;
}
```

### LabInfo Interface

```typescript
export interface LabInfo {
  lab_id: string;               // Required
  description?: string;         // Optional
  faculty?: string[];           // Optional: array of researcher_ids
}
```

---

## Node Creation (Backend)

### Researcher Node Creation

**Location:** `backend/graph_core.py`

```python
nodes.append({
    "id": rid,                    # researcher_id from DynamoDB
    "name": r["name"],
    "val": 1,                     # Fixed value for researchers
    "type": "researcher",
    "advisor": r.get("advisor"),
    "contact_info": r.get("contact_info"),
    "labs": r.get("labs"),
    "standing": r.get("standing"),
    "papers": papers,             # Array from fetch_papers()
    "tags": tags,                 # Sorted set from papers
    "influence": metrics_map.get(rid),
    "about": descriptions_map.get(rid),
})
```

### Lab Node Creation

```python
for lab in labs:
    nodes.append({
        "id": lab["lab_id"],
        "name": lab["name"],
        "val": 2,                 # Fixed value for labs
        "type": "lab",
    })
```

---

## Link Types

### Paper Edge

Two researchers co-authored a paper.

```python
{
    "source": edge["researcher_one_id"],
    "target": edge["researcher_two_id"],
    "type": "paper",
}
```

### Advisor Edge

Advisee → Advisor relationship.

```python
{
    "source": edge["advisee_id"],
    "target": edge["advisor_id"],
    "type": "advisor",
}
```

### Researcher-Lab Edge

Researcher belongs to lab.

```python
{
    "source": researcher_id,
    "target": lab_id,
    "type": "researcher_lab",
}
```

---

## Rendering Configuration

### Node Colors

| Node Type | Default | Highlighted |
|-----------|---------|-------------|
| Researcher | `#1f2937` (gray) | `#00ff00` (green) |
| Lab | `#2563eb` (blue) | `#00ff00` (green) |

### Node Shapes

| Node Type | Shape | Size |
|-----------|-------|------|
| Researcher | Sphere | Radius 3 |
| Lab | Box | 6×6×6 |

### Link Styling

| Link Type | Color | Width | Arrow | Curvature |
|-----------|-------|-------|-------|-----------|
| paper | `#6b7280` (gray) | 2 | None | 0 |
| advisor | `#dc2626` (red) | 1 | 4 | 0.25 |
| researcher_lab | `#059669` (green) | 2 | 3 | 0.15 |

---

## Client-Side Transformations

### Search Filtering

The SearchBar filters nodes by:
- Name (case-insensitive match)
- Labs (any lab matches query)
- Tags (any tag matches query)

Results are sorted: name matches first, then lab matches, then tag matches.

### Paper Sorting

Papers in researcher profiles are sorted by year descending (newest first).

### Local Recommendations Fallback

If Bedrock recommendations fail, the frontend uses Jaccard-like word overlap:

```typescript
const lcResume = text.toLowerCase();
const scored = graphData.nodes
  .filter(n => n.type === 'researcher')
  .map(n => {
    const tags = (n.tags || []).join(' ').toLowerCase();
    const about = (n.about || '').toLowerCase();
    // Calculate word overlap
    const resumeWords = new Set(lcResume.split(/[^a-z0-9]+/).filter(Boolean));
    const textWords = new Set((tags + ' ' + about).split(/[^a-z0-9]+/).filter(Boolean));
    let overlap = 0;
    for (const w of resumeWords) {
      if (textWords.has(w)) overlap++;
    }
    const denom = Math.max(1, resumeWords.size + textWords.size - overlap);
    return { name: n.name, score: overlap / denom };
  })
  .sort((a, b) => b.score - a.score)
  .slice(0, 10);
```

---

## Required JSON Structure

```json
{
  "nodes": [
    {
      "id": "string (researcher_id or lab_id)",
      "name": "string",
      "type": "researcher" | "lab",
      "val": 1 | 2,
      
      // Researcher-only fields:
      "advisor": "string | null",
      "contact_info": ["string"] | null,
      "labs": ["string"] | null,
      "standing": "string | null",
      "papers": [
        {
          "title": "string",
          "year": "number",
          "document_id": "string",
          "tags": ["string"] | null
        }
      ] | null,
      "tags": ["string"] | null,
      "influence": "number | null",
      "about": "string | null"
    }
  ],
  "links": [
    {
      "source": "string (node id)",
      "target": "string (node id)",
      "type": "paper" | "advisor" | "researcher_lab"
    }
  ]
}
```

---

## Validation Checklist

- [ ] All researcher nodes have `id`, `name`, `type: "researcher"`, `val: 1`
- [ ] All lab nodes have `id`, `name`, `type: "lab"`, `val: 2`
- [ ] Tags are sorted and unique (no duplicates)
- [ ] Papers array contains objects with `title`, `year`, `document_id`
- [ ] Links have `source`, `target`, `type` fields
- [ ] Link `source` and `target` reference valid node `id`s
- [ ] Optional fields are either present with correct types or omitted

---

## Lab List

The backend includes these hardcoded labs:

| Lab ID | Display Name |
|--------|--------------|
| `aims_lab` | AIMS Lab |
| `behavioral_data_science_group` | Behavioral Data Science Group |
| `bespoke_silicon_group` | Bespoke Silicon Group |
| `database_group` | Database Group |
| `h2_lab` | H2 Lab |
| `human_centered_robotics_lab` | Human-Centered Robotics Lab |
| `ictd_lab` | ICTD Lab |
| `interactive_data_lab` | Interactive Data Lab |
| `make4all_group` | Make4all Group |
| `makeability_lab` | Makeability Lab |
| `molecular_information_systems_lab` | MISL |
| `mostafavi_lab` | Mostafavi Lab |
| `personal_robotics_lab` | Personal Robotics Lab |
| `raivn_lab` | RAIVN Lab |
| `robot_learning_lab` | Robot Learning Lab |
| `sampl` | SAMPL |
| `social_futures_lab` | Social Futures Lab |
| `social_rl_lab` | Social RL Lab |
| `snail_lab` | SNAIL |
| `theory_of_computation_group` | Theory of Computation Group |
| `tsvetshop` | Tsvetshop |
| `ubicomp_lab` | UbiComp Lab |
| `uw_reality_lab` | UW Reality Lab |
| `weird_lab` | WEIRD Lab |
| `wildlab` | Wildlab |
