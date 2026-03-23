import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    const message = (error?.message || '') + ' ' + (error?.stack || '') + ' ' + (typeof error === 'string' ? error : '');
    if (message.includes('MetaMask') || message.includes('ethereum') || message.includes('metamask')) {
      return { hasError: false, error: null, errorInfo: null };
    }
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const message = (error?.message || '') + ' ' + (error?.stack || '') + ' ' + (typeof error === 'string' ? error : '');
    if (message.includes('MetaMask') || message.includes('ethereum') || message.includes('metamask')) {
      return; // Ignore MetaMask errors
    }
    console.error("🔥 [ErrorBoundary] Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
    
    // Log to backend service
    fetch('/api/log-error', { 
      method: 'POST', 
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        error: {
          message: error.message,
          stack: error.stack
        }, 
        errorInfo: {
          componentStack: errorInfo.componentStack
        },
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: Date.now()
      }) 
    }).catch(err => console.error("Failed to send error log to backend:", err));
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div style={{ 
          padding: '20px', 
          color: '#f8fafc', 
          background: '#0f172a', 
          zIndex: 9999, 
          position: 'absolute', 
          top: 0, left: 0, right: 0, bottom: 0,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'flex-start'
        }}>
          <h2 style={{ color: '#ef4444', marginBottom: '10px', fontSize: '20px', fontWeight: 'bold' }}>
            Ocorreu um erro de renderização no 3D
          </h2>
          <button 
            onClick={this.handleRetry}
            style={{
              padding: '8px 16px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginBottom: '20px',
              fontWeight: 'bold'
            }}
          >
            Tentar Novamente
          </button>
          
          <div style={{ background: '#1e293b', padding: '15px', borderRadius: '8px', width: '100%', overflowX: 'auto' }}>
            <h3 style={{ color: '#f8fafc', marginBottom: '10px', fontSize: '16px' }}>Mensagem de Erro:</h3>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '14px', color: '#fca5a5', margin: 0 }}>
              {this.state.error?.message}
            </pre>
          </div>

          <div style={{ background: '#1e293b', padding: '15px', borderRadius: '8px', width: '100%', overflowX: 'auto', marginTop: '15px' }}>
            <h3 style={{ color: '#f8fafc', marginBottom: '10px', fontSize: '16px' }}>Stack Trace:</h3>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px', color: '#94a3b8', margin: 0 }}>
              {this.state.error?.stack}
            </pre>
          </div>
          
          {this.state.errorInfo && (
            <div style={{ background: '#1e293b', padding: '15px', borderRadius: '8px', width: '100%', overflowX: 'auto', marginTop: '15px' }}>
              <h3 style={{ color: '#f8fafc', marginBottom: '10px', fontSize: '16px' }}>Component Stack:</h3>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px', color: '#94a3b8', margin: 0 }}>
                {this.state.errorInfo.componentStack}
              </pre>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
