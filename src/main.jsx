import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import '@fortawesome/fontawesome-free/css/all.min.css'
import './index.css'
import Dashboard from './dashboard/Dashboard.jsx'
import Analyzer from './analyzer/Analyzer.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/analyzer" element={<Analyzer />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
