import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Nyro] Render error:', error, info)
  }

  render() {
    const { error } = this.state
    if (error) {
      return (
        <div style={{
          position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16,
          background: '#0a0e14', color: '#e7ecf3', fontFamily: 'monospace', padding: 32
        }}>
          <div style={{ fontSize: 14, color: '#ff5d6c', fontWeight: 700 }}>Render error</div>
          <pre style={{
            background: '#1b2433', padding: 16, borderRadius: 8, fontSize: 12,
            color: '#e7ecf3', maxWidth: 700, overflow: 'auto', whiteSpace: 'pre-wrap'
          }}>
            {error.message}
            {'\n\n'}
            {error.stack}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ padding: '8px 20px', background: '#3D7FFF', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
