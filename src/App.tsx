import ResearchNetworkGraph from './components/ResearchNetworkGraph'
import { AccessibilityProvider } from './contexts/AccessibilityContext'

function App() {
  return (
    <AccessibilityProvider>
      <div className="w-full h-screen">
        <ResearchNetworkGraph />
      </div>
    </AccessibilityProvider>
  )
}

export default App