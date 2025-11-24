export async function fetchGraphData() {
  console.log("Calling fetchGraphData...");
  const url = `${import.meta.env.VITE_API_URL}/api/graph/data`;
  console.log("Fetch URL:", url);
  console.log("Before fetch");
  
  try {
    const res = await fetch(url);
    console.log("After fetch - Response status:", res.status, res.statusText);
    console.log("Response headers:", Object.fromEntries(res.headers.entries()));
    
    if (!res.ok) {
      console.error("Response not OK:", res.status, res.statusText);
      throw new Error("Failed to fetch graph data");
    }
    
    const data = await res.json();
    console.log("Successfully parsed JSON response");
    return data;
  } catch (error) {
    console.error("Error in fetchGraphData:", error);
    throw error;
  }
}

export async function fetchPaperLabId(documentId: string) {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/api/graph/paper-lab-id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ document_id: documentId }),
  });

  if (!res.ok) throw new Error("Failed to fetch lab_id for paper");

  const data = await res.json();
  return data.lab_id || null;
}
