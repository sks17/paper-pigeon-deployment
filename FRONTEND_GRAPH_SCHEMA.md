# Frontend Graph Data Schema and Transformations

This document provides a complete specification of the graph data structure expected by the frontend, including all TypeScript interfaces, node/link creation patterns, client-side transformations, and rendering requirements.

---

## Section A: TypeScript Interfaces

### GraphData Interface
```typescript
// Imported from: src/services/dynamodb.ts
// Used in: ResearchNetworkGraph.tsx, SearchBar.tsx
export type GraphData = {
  nodes: Node[];
  links: Link[];
}
```

### Node Interface
```typescript
// Imported as: type Node (implicitly from GraphData)
// Used throughout components
interface Node {
  id: string;                    // Required: unique identifier
  name: string;                  // Required: display name
  type: 'researcher' | 'lab';    // Required: node type discriminator
  val?: number;                  // Optional: rendering size/weight (researcher=1, lab=2)
  
  // Researcher-specific fields (only present when type === 'researcher')
  advisor?: string;              // Optional: advisor name
  contact_info?: string[];       // Optional: array of contact strings (email/phone/url)
  labs?: string[];              // Optional: array of lab names
  standing?: string;            // Optional: academic standing (e.g., "Professor", "PhD Student")
  papers?: Paper[];             // Optional: array of paper objects
  tags?: string[];              // Optional: sorted array of research area tags
  influence?: number;           // Optional: influence score (0-100)
  about?: string;               // Optional: description/about text
  researcher_id?: string;       // Optional: used in LabModal for faculty mapping
}
```

### Link Interface
```typescript
// Imported as: type Link (implicitly from GraphData)
// Used in: ResearchNetworkGraph.tsx
interface Link {
  source: string;               // Required: source node id
  target: string;              // Required: target node id
  type: 'paper' | 'advisor' | 'researcher_lab';  // Required: link type
}
```

### Paper Interface
```typescript
// Imported from: src/services/dynamodb.ts
// Used in: ResearcherModal.tsx, ResearcherProfilePanel.tsx, PaperChatModal.tsx
export type Paper = {
  title: string;                // Required: paper title
  year: number;                 // Required: publication year
  document_id: string;          // Required: unique document identifier
  tags?: string[];              // Optional: array of tags
  // Note: May have other fields from DynamoDB, but these are the ones used
}
```

### Researcher Interface
```typescript
// Imported from: src/services/dynamodb.ts
// Used throughout components
export type Researcher = Node & {
  // All Node fields plus:
  // type: 'researcher' (required)
  // All researcher-specific fields listed above
}
```

### LabInfo Interface
```typescript
// Imported from: src/services/dynamodb.ts
// Used in: LabModal.tsx
export type LabInfo = {
  lab_id: string;               // Required
  description?: string;          // Optional
  faculty?: string[];            // Optional: array of researcher_ids
}
```

---

## Section B: Node Creation Functions

### Researcher Node Creation
**Location:** `backend/graph_core.py` (lines 74-87)

```python
nodes.append({
    "id": rid,                    # researcher_id from DynamoDB
    "name": r["name"],            # from researchers table
    "val": 1,                     # Fixed value for researchers
    "type": "researcher",         # Fixed type
    "advisor": r.get("advisor"),  # Optional from researchers table
    "contact_info": r.get("contact_info"),  # Optional array from researchers table
    "labs": r.get("labs"),        # Optional array from researchers table
    "standing": r.get("standing"), # Optional from researchers table
    "papers": papers,             # Array from fetch_papers(document_ids)
    "tags": tags,                 # Sorted set extracted from papers
    "influence": metrics_map.get(rid),  # Optional from metrics table
    "about": descriptions_map.get(rid), # Optional from descriptions table
})
```

**Tag Extraction Logic:**
```python
tags = sorted({
    tag for p in papers for tag in p.get("tags", [])
})
```

### Lab Node Creation
**Location:** `backend/graph_core.py` (lines 122-128)

```python
for lab in labs:
    nodes.append({
        "id": lab["lab_id"],      # Hardcoded lab_id
        "name": lab["name"],      # Hardcoded lab name
        "val": 2,                 # Fixed value for labs
        "type": "lab",           # Fixed type
    })
```

**Lab List (Hardcoded):**
```python
labs = [
    {"lab_id": "aims_lab", "name": "AIMS Lab"},
    {"lab_id": "behavioral_data_science_group", "name": "Behavioral Data Science Group"},
    {"lab_id": "bespoke_silicon_group", "name": "Bespoke Silicon Group"},
    {"lab_id": "database_group", "name": "Database Group"},
    {"lab_id": "h2_lab", "name": "H2 Lab"},
    {"lab_id": "human_centered_robotics_lab", "name": "Human-Centered Robotics Lab"},
    {"lab_id": "ictd_lab", "name": "ICTD Lab"},
    {"lab_id": "interactive_data_lab", "name": "Interactive Data Lab"},
    {"lab_id": "make4all_group", "name": "Make4all Group"},
    {"lab_id": "makeability_lab", "name": "Makeability Lab"},
    {"lab_id": "molecular_information_systems_lab", "name": "MISL"},
    {"lab_id": "mostafavi_lab", "name": "Mostafavi Lab"},
    {"lab_id": "personal_robotics_lab", "name": "Personal Robotics Lab"},
    {"lab_id": "raivn_lab", "name": "RAIVN Lab"},
    {"lab_id": "robot_learning_lab", "name": "Robot Learning Lab"},
    {"lab_id": "sampl", "name": "SAMPL"},
    {"lab_id": "social_futures_lab", "name": "Social Futures Lab"},
    {"lab_id": "social_rl_lab", "name": "Social RL Lab"},
    {"lab_id": "snail_lab", "name": "SNAIL"},
    {"lab_id": "theory_of_computation_group", "name": "Theory of Computation Group"},
    {"lab_id": "tsvetshop", "name": "Tsvetshop"},
    {"lab_id": "ubicomp_lab", "name": "UbiComp Lab"},
    {"lab_id": "uw_reality_lab", "name": "UW Reality Lab"},
    {"lab_id": "weird_lab", "name": "WEIRD Lab"},
    {"lab_id": "wildlab", "name": "Wildlab"},
]
```

---

## Section C: Edge/Link Creation Functions

### Paper Edge Creation
**Location:** `backend/graph_core.py` (lines 130-140)

```python
for edge in paper_edges:
    if (
        edge["researcher_one_id"] in researcher_map and
        edge["researcher_two_id"] in researcher_map
    ):
        links.append({
            "source": edge["researcher_one_id"],
            "target": edge["researcher_two_id"],
            "type": "paper",
        })
```

**Note:** Only creates links if both researchers exist in the graph.

### Advisor Edge Creation
**Location:** `backend/graph_core.py` (lines 142-152)

```python
for edge in advisor_edges:
    if (
        edge["advisee_id"] in researcher_map and
        edge["advisor_id"] in researcher_map
    ):
        links.append({
            "source": edge["advisee_id"],
            "target": edge["advisor_id"],
            "type": "advisor",
        })
```

**Note:** Only creates links if both researchers exist in the graph.

### Researcher-Lab Link Creation
**Status:** ⚠️ **NOT CURRENTLY IMPLEMENTED IN BACKEND**

**Frontend Expectation:** `src/components/ResearchNetworkGraph.tsx` (lines 329, 334, 339, 344, 350)

The frontend expects links with `type: 'researcher_lab'` but the backend does not create them. The frontend handles them with:
- Color: `#059669` (green)
- Width: `2`
- Arrow length: `3`
- Arrow color: `#059669`
- Curvature: `0.15`

**Expected Structure (if implemented):**
```python
# Hypothetical implementation
for researcher in researchers:
    if researcher.get("labs"):
        for lab_name in researcher["labs"]:
            # Map lab_name to lab_id (would need lookup)
            lab_id = lab_name_to_id_map.get(lab_name)
            if lab_id:
                links.append({
                    "source": researcher["researcher_id"],
                    "target": lab_id,
                    "type": "researcher_lab",
                })
```

---

## Section D: Client-Side Transformations

### Search Bar Transformations
**Location:** `src/components/SearchBar.tsx`

#### Search Result Creation (lines 42-72)
```typescript
graphData.nodes.forEach(node => {
  const nodeName = node.name.toLowerCase();
  const matchesName = nodeName.includes(normalizedQuery);
  const matchesLab = node.labs?.some(lab => 
    lab.toLowerCase().includes(normalizedQuery)
  ) || false;
  const matchesTag = node.tags?.some(tag => 
    tag.toLowerCase().includes(normalizedQuery)
  ) || false;

  if (matchesName || matchesLab || matchesTag) {
    results.push({
      id: node.id,
      name: node.name,
      type: node.type || 'researcher',
      labs: node.labs,
      standing: node.standing,
      tags: node.tags,
    });
  }
});
```

#### Search Result Sorting (lines 75-96)
```typescript
results.sort((a, b) => {
  const aNameMatch = a.name.toLowerCase().includes(normalizedQuery);
  const bNameMatch = b.name.toLowerCase().includes(normalizedQuery);
  const aLabMatch = a.labs?.some(lab => lab.toLowerCase().includes(normalizedQuery)) || false;
  const bLabMatch = b.labs?.some(lab => lab.toLowerCase().includes(normalizedQuery)) || false;
  const aTagMatch = a.tags?.some(tag => tag.toLowerCase().includes(normalizedQuery)) || false;
  const bTagMatch = b.tags?.some(tag => tag.toLowerCase().includes(normalizedQuery)) || false;
  
  // Name matches first
  if (aNameMatch && !bNameMatch) return -1;
  if (!aNameMatch && bNameMatch) return 1;
  
  // Then lab matches
  if (aLabMatch && !bLabMatch) return -1;
  if (!aLabMatch && bLabMatch) return 1;
  
  // Then tag matches
  if (aTagMatch && !bTagMatch) return -1;
  if (!aTagMatch && bTagMatch) return 1;
  
  return a.name.localeCompare(b.name);
});
```

#### Result Limiting (line 98)
```typescript
setSearchResults(results.slice(0, 10)); // Limit to 10 results
```

#### Tag Display Truncation (line 383)
```typescript
{result.tags.slice(0, 3).join(', ')}
{result.tags.length > 3 && ` +${result.tags.length - 3} more`}
```

### Researcher Modal Transformations
**Location:** `src/components/ResearcherModal.tsx`

#### Paper Sorting (line 258)
```typescript
researcher.papers
  .sort((a, b) => b.year - a.year)  // Sort by year descending
  .map((paper, index) => (
    // Render paper
  ))
```

#### About Text Truncation (lines 186-208)
```typescript
const ABOUT_PREVIEW_CHARS = 220;
const aboutText = researcher.about || '';
const isTruncated = aboutText.length > ABOUT_PREVIEW_CHARS;
const displayedAbout = showFullAbout 
  ? aboutText 
  : aboutText.slice(0, ABOUT_PREVIEW_CHARS) + (isTruncated ? '…' : '');
```

#### Contact Info Formatting (lines 82-97)
```typescript
const formatContactInfo = (contact: string) => {
  // Check if it's an email
  if (contact.includes('@')) {
    return { type: 'email', value: contact, icon: Mail };
  }
  // Check if it's a phone number
  if (/^[\+]?[1-9][\d]{0,15}$/.test(contact.replace(/[\s\-\(\)]/g, ''))) {
    return { type: 'phone', value: contact, icon: Phone };
  }
  // Check if it's a URL
  if (contact.startsWith('http') || contact.includes('.')) {
    return { type: 'url', value: contact, icon: Globe };
  }
  // Default to other
  return { type: 'other', value: contact, icon: User };
};
```

### Recommendations Transformations
**Location:** `src/components/ResearchNetworkGraph.tsx` (lines 209-234)

#### Fallback Local Similarity (when backend recommendations fail)
```typescript
if (!recs || recs.length === 0) {
  const lcResume = text.toLowerCase();
  const scored = graphData.nodes
    .filter(n => n.type === 'researcher')
    .map(n => {
      const tags = (n.tags || []).join(' ').toLowerCase();
      const about = (n.about || '').toLowerCase();
      // Simple Jaccard-like overlap on words
      const resumeWords = new Set(lcResume.split(/[^a-z0-9]+/).filter(Boolean));
      const textWords = new Set((tags + ' ' + about).split(/[^a-z0-9]+/).filter(Boolean));
      let overlap = 0;
      for (const w of resumeWords) {
        if (textWords.has(w)) overlap++;
      }
      const denom = Math.max(1, resumeWords.size + textWords.size - overlap);
      const score = overlap / denom;
      return { name: n.name, score, rationale: undefined };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  recs = scored;
}
```

#### Score Boosting (RecommendationsModal.tsx, line 86)
```typescript
const boosted = Math.min(1, rec.score * 2.0 + 0.25);
const scorePct = Math.round(boosted * 100);
```

### Name to Researcher ID Mapping
**Location:** `src/components/ResearchNetworkGraph.tsx` (lines 173-184)

```typescript
const nameToResearcherId = React.useMemo(() => {
  const map = new Map<string, string>();
  if (graphData) {
    for (const n of graphData.nodes) {
      if (n.type === 'researcher') {
        // Graph node id is the researcher_id
        map.set(n.name, n.id);
      }
    }
  }
  return map;
}, [graphData]);
```

---

## Section E: Rendering-Dependent Fields

### Node Rendering Fields
**Location:** `src/components/ResearchNetworkGraph.tsx` (lines 292-326, 386-420)

#### Node Shape and Size
```typescript
// Lab nodes
if (node.type === 'lab') {
  const geometry = new THREE.BoxGeometry(6, 6, 6);  // Box shape
  const material = new THREE.MeshBasicMaterial({ 
    color: isHighlighted ? '#00ff00' : '#2563eb'  // Blue, green when highlighted
  });
}

// Researcher nodes
else {
  const geometry = new THREE.SphereGeometry(3, 16, 16);  // Sphere shape
  const material = new THREE.MeshBasicMaterial({ 
    color: isHighlighted ? '#00ff00' : '#1f2937'  // Gray, green when highlighted
  });
}
```

#### Node Text Sprite
```typescript
const sprite = new SpriteText(node.name);
sprite.color = isHighlighted 
  ? '#00ff00'  // Neon green when highlighted
  : (node.type === 'lab' ? '#2563eb' : '#1f2937');  // Blue for labs, gray for researchers
sprite.textHeight = node.type === 'lab' ? 8 : 6;
sprite.position.y = node.type === 'lab' ? 10 : 8;
```

#### Node Value (`val` field)
- **Researcher nodes:** `val: 1` (used for rendering size/weight)
- **Lab nodes:** `val: 2` (used for rendering size/weight)

**Note:** The `val` field is set in the backend but may be used by the 3D force graph library for node sizing.

### Link Rendering Fields
**Location:** `src/components/ResearchNetworkGraph.tsx` (lines 327-352)

#### Link Colors
```typescript
.linkColor((link: any) => {
  if (link.type === 'advisor') return '#dc2626';           // Red
  if (link.type === 'researcher_lab') return '#059669';     // Green
  return '#6b7280';                                        // Gray for paper
})
```

#### Link Widths
```typescript
.linkWidth((link: any) => {
  if (link.type === 'advisor') return 1;                   // Very thin
  if (link.type === 'researcher_lab') return 2;              // Normal
  return 2;                                                 // Normal for paper
})
```

#### Link Arrow Lengths
```typescript
.linkDirectionalArrowLength((link: any) => {
  if (link.type === 'advisor') return 4;                    // Arrows for advisor
  if (link.type === 'researcher_lab') return 3;             // Arrows for researcher-to-lab
  return 0;                                                 // No arrows for paper
})
```

#### Link Arrow Colors
```typescript
.linkDirectionalArrowColor((link: any) => {
  if (link.type === 'advisor') return '#dc2626';            // Red arrows
  if (link.type === 'researcher_lab') return '#059669';     // Green arrows
  return '#6b7280';                                        // Gray for paper
})
```

#### Link Curvature
```typescript
.linkCurvature((link: any) => {
  if (link.type === 'advisor') return 0.25;                 // Curved arrows
  if (link.type === 'researcher_lab') return 0.15;           // Slightly curved
  return 0;                                                 // Straight for paper
})
```

---

## Section F: React Component Data Modifications/Filters/Enrichments

### ResearchNetworkGraph Component

#### Node Highlighting
**Location:** Lines 297, 391
```typescript
const isHighlighted = highlightedNodes.includes(node.id);
```
- Changes node color to `#00ff00` (neon green) when highlighted
- Applied dynamically via `useEffect` hook (lines 382-421)

#### Node Hover Handling
**Location:** Lines 81-112
```typescript
const handleNodeHover = useCallback((node: any) => {
  if (node && node.type === 'researcher') {
    // Debounce hover by 150ms
    setTimeout(() => {
      setHoveredResearcher(node);
      setShowProfilePanel(true);
    }, 150);
  }
}, []);
```

#### Node Click Handling
**Location:** Lines 131-139
```typescript
const handleNodeClick = useCallback(async (node: any) => {
  if (node.type === 'researcher') {
    setSelectedResearcher(node);
    setShowModal(true);
  } else if (node.type === 'lab') {
    openLabWithData(node.id, node.name);
  }
}, [openLabWithData]);
```

#### Graph Data Filtering for Recommendations
**Location:** Lines 212-214
```typescript
const scored = graphData.nodes
  .filter(n => n.type === 'researcher')  // Only researchers
  .map(n => {
    // ... scoring logic
  })
```

### SearchBar Component

#### Node Filtering for Search
**Location:** Lines 52-72
- Filters nodes by name, labs, or tags matching search query
- Case-insensitive matching
- Creates `SearchResult` objects with subset of node fields

#### Node Highlighting from Search
**Location:** Lines 102-128
```typescript
const highlightNodes = useCallback((query: string) => {
  const normalizedQuery = query.toLowerCase().trim();
  const highlightedIds: string[] = [];

  graphData.nodes.forEach(node => {
    const nodeName = node.name.toLowerCase();
    const matchesName = nodeName.includes(normalizedQuery);
    const matchesLab = node.labs?.some(lab => 
      lab.toLowerCase().includes(normalizedQuery)
    ) || false;
    const matchesTag = node.tags?.some(tag => 
      tag.toLowerCase().includes(normalizedQuery)
    ) || false;

    if (matchesName || matchesLab || matchesTag) {
      highlightedIds.push(node.id);
    }
  });

  onHighlightNodes(highlightedIds);
}, [graphData, onHighlightNodes]);
```

### ResearcherModal Component

#### Paper Sorting
**Location:** Line 258
```typescript
researcher.papers
  .sort((a, b) => b.year - a.year)  // Descending by year
```

#### About Text Truncation
**Location:** Lines 186-208
- Truncates `about` text to 220 characters with "Read more" toggle

#### Contact Info Enrichment
**Location:** Lines 82-97, 301-327
- Detects email, phone, URL patterns
- Adds appropriate icons and click handlers
- Converts URLs to clickable links with `https://` prefix if needed

### ResearcherProfilePanel Component

#### Contact Info Formatting
**Location:** Lines 72-87, 194-220
- Same logic as ResearcherModal for contact info formatting

### LabModal Component

#### Description Truncation
**Location:** Lines 33-37
```typescript
const MAX = 240;
const preview = description.length > MAX 
  ? description.slice(0, MAX) + '…' 
  : description;
```

#### Faculty Mapping
**Location:** ResearchNetworkGraph.tsx, lines 67-69
```typescript
const faculty = info.faculty.map(id => researcherMap[id]).filter(Boolean);
```
- Maps `researcher_id` strings to full researcher objects
- Filters out missing researchers

---

## Section G: Summary - What Python Backend Must Replicate

### Required JSON Structure

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
          "year": number,
          "document_id": "string",
          "tags": ["string"] | null
        }
      ] | null,
      "tags": ["string"] | null,  // Sorted, unique tags from papers
      "influence": number | null,  // 0-100
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

### Critical Requirements

1. **Node `id` field:**
   - For researchers: Must be the `researcher_id` (used for lookups in LabModal)
   - For labs: Must be the `lab_id` (hardcoded list)

2. **Node `type` field:**
   - Must be exactly `"researcher"` or `"lab"` (case-sensitive)
   - Used for conditional rendering throughout frontend

3. **Node `val` field:**
   - Researchers: `1`
   - Labs: `2`
   - Used by 3D force graph for node sizing

4. **Tags Array:**
   - Must be sorted and unique
   - Extracted from all papers' tags
   - Used for search and filtering

5. **Papers Array:**
   - Must include `title`, `year`, `document_id`
   - Frontend sorts by `year` descending
   - `document_id` is required for PDF access

6. **Link Types:**
   - `"paper"`: Between researchers (from paper_edges)
   - `"advisor"`: From advisee to advisor (from advisor_edges)
   - `"researcher_lab"`: ⚠️ **NOT IMPLEMENTED** - Frontend expects but backend doesn't create

7. **Optional Fields:**
   - All fields except `id`, `name`, `type`, `val` are optional
   - Frontend handles `null`/`undefined` gracefully
   - Arrays can be empty `[]` or `null`/`undefined`

8. **Data Types:**
   - `influence`: Must be a number (0-100) if present
   - `year`: Must be a number
   - `contact_info`: Must be an array of strings
   - `labs`: Must be an array of strings
   - `tags`: Must be an array of strings (sorted)
   - `papers`: Must be an array of Paper objects

### Missing Implementation

**Researcher-Lab Links:** The frontend expects `type: 'researcher_lab'` links but the backend does not create them. To implement:

1. Create links from researchers to labs based on `researcher.labs` array
2. Map lab names to lab_ids (using the hardcoded lab list)
3. Add links with `type: "researcher_lab"`

### Validation Checklist

- [ ] All researcher nodes have `id`, `name`, `type: "researcher"`, `val: 1`
- [ ] All lab nodes have `id`, `name`, `type: "lab"`, `val: 2`
- [ ] Tags are sorted and unique (no duplicates)
- [ ] Papers array contains objects with `title`, `year`, `document_id`
- [ ] Links have `source`, `target`, `type` fields
- [ ] Link `source` and `target` reference valid node `id`s
- [ ] Optional fields are either present with correct types or omitted entirely
- [ ] Arrays are either present (even if empty) or omitted (not `null` unless explicitly needed)

---

## Additional Notes

### Frontend Type Imports
All types are imported from `src/services/dynamodb.ts`:
```typescript
import { fetchGraphData, type GraphData, type Researcher, type Paper } from '../services/dynamodb';
```

However, the actual type definitions are not visible in the codebase - they may be:
1. Inferred by TypeScript from usage
2. Defined in a separate `.d.ts` file not found
3. Generated from backend responses

### Backend Data Sources

- **Researchers:** `fetch_researchers()` from DynamoDB `researchers` table
- **Papers:** `fetch_papers(document_ids)` from DynamoDB `papers` table
- **Paper Edges:** `fetch_paper_edges()` from DynamoDB `paper-edges` table
- **Advisor Edges:** `fetch_advisor_edges()` from DynamoDB `advisor_edges` table
- **Descriptions:** `fetch_descriptions(researcher_ids)` from DynamoDB `descriptions` table
- **Metrics:** `fetch_metrics(researcher_ids)` from DynamoDB `metrics` table
- **Library Entries:** `fetch_library_entries(researcher_id)` from DynamoDB `library` table

### Error Handling

The backend should handle missing data gracefully:
- Missing papers: Empty array `[]` or omit `papers` field
- Missing library entries: Empty array `[]` (results in empty `papers` array)
- Missing tags: Empty array `[]` or omit `tags` field
- Missing descriptions: Omit `about` field or set to `null`
- Missing metrics: Omit `influence` field or set to `null`

The frontend checks for existence before accessing optional fields.

