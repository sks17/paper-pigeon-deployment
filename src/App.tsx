import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ResearchNetworkGraph from './components/ResearchNetworkGraph';
import VRResearchNetworkGraph from './components/VRResearchNetworkGraph';
import { AccessibilityProvider } from './contexts/AccessibilityContext';

function App() {
  return (
    <AccessibilityProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/graph" element={
            <div className="w-full h-screen">
              <ResearchNetworkGraph />
            </div>
          } />
          <Route path="/graph-vr" element={
            <div className="w-full h-screen">
              <VRResearchNetworkGraph />
            </div>
          } />
          <Route path="/" element={<Navigate to="/graph" replace />} />
        </Routes>
      </BrowserRouter>
    </AccessibilityProvider>
  );
}

export default App;