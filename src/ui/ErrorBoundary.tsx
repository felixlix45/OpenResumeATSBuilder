/**
 * Error boundary.
 *
 * A crash in the preview (the most likely place, since it owns the PDF renderer)
 * must not take the editor with it. The document itself is safe in local storage,
 * so the recovery path is: offer the JSON export, then offer a reload.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './primitives';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  info: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Kept in the component rather than sent anywhere: nothing leaves the device.
    this.setState({ info: info.componentStack ?? null });
    console.error('Resume Forge crashed:', error, info.componentStack);
  }

  private exportData = () => {
    try {
      const raw = localStorage.getItem('resume-forge:document');
      if (!raw) return;
      const blob = new Blob([raw], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'resume-forge-recovery.json';
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      /* nothing more we can do here */
    }
  };

  override render(): ReactNode {
    const { error, info } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="app">
        <div className="pane__scroll">
          <div className="editor">
            <div className="error-box" role="alert">
              <h1 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>
                Something went wrong rendering this page
              </h1>
              <p>
                Your resume is still saved in this browser. Export a copy before reloading if you want to be certain.
              </p>
              <div className="row" style={{ marginTop: 'var(--space-3)' }}>
                <Button variant="primary" onClick={() => window.location.reload()}>
                  Reload the page
                </Button>
                <Button onClick={this.exportData}>Export my data</Button>
              </div>
              <pre>
                {error.message}
                {info ? `\n${info.split('\n').slice(0, 6).join('\n')}` : ''}
              </pre>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
