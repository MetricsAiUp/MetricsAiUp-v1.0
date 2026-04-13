import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-8"
          style={{ color: 'var(--text-primary)' }}>
          <AlertTriangle size={48} style={{ color: 'var(--accent)', marginBottom: '1rem' }} />
          <h2 className="text-lg font-bold mb-2">
            {this.props.fallbackTitle || 'Something went wrong'}
          </h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            {this.state.error?.message}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {this.props.retryLabel || 'Retry'}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
