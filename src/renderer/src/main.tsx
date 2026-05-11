import React from 'react'
import ReactDOM from 'react-dom/client'
import { TriangleAlert } from 'lucide-react'
import App from './App'
import './styles/global.css'

// ── Error Boundary ────────────────────────────────────────────────────────────

interface EBState { error: Error | null }

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, EBState> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error): EBState {
    return { error }
  }
  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: 'monospace', color: '#f08080', background: '#1a0505', minHeight: '100vh' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TriangleAlert size={20} aria-hidden="true" /> Erro na aplicação
          </h2>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Render ────────────────────────────────────────────────────────────────────

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
