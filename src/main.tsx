import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.tsx';
import { VisualizadorPublico } from './pages/VisualizadorPublico.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/p/:id" element={<VisualizadorPublico />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
