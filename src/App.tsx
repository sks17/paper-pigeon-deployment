/**
 * Paper Pigeon - Root Application Component
 *
 * Handles routing between the main 3D graph view and VR mode.
 * Graph data is fetched once at the app level and passed down to child routes.
 */
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import ResearchNetworkGraph from './components/ResearchNetworkGraph'
import VRGraph from './components/VRGraph'
import { AccessibilityProvider } from './contexts/AccessibilityContext'
import { fetchGraphData, type GraphData } from './services/dynamodb'

function App() {
  const [graphData, setGraphData] = useState<GraphData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await fetchGraphData()
        setGraphData(data)
      } catch (err) {
        console.error('Failed to load graph data:', err)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  return (
    <BrowserRouter>
      <AccessibilityProvider>
        <Routes>
          <Route path="/" element={
            <div className="w-full h-screen">
              <ResearchNetworkGraph graphData={graphData} loading={loading} />
            </div>
          } />
          <Route path="/vr" element={
            <VRGraph graphData={graphData} loading={loading} />
          } />
        </Routes>
      </AccessibilityProvider>
    </BrowserRouter>
  )
}

export default App