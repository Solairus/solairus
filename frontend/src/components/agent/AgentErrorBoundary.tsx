import React, { Component, ReactNode } from 'react';
import { AgentErrorHandler } from '@/utils/agent-error-handler';
import { AgentData } from '@/services/agent/agent-service';
import { AgentErrorDisplay } from './AgentErrorDisplay';
import { Button } from '@/components/ui/button';
import { RefreshCw, Home, AlertTriangle } from 'lucide-react';

interface AgentErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  context?: string;
  agent?: AgentData;
  showRetryButton?: boolean;
  showHomeButton?: boolean;
}

interface AgentErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  retryCount: number;
}

export class AgentErrorBoundary extends Component<AgentErrorBoundaryProps, AgentErrorBoundaryState> {
  private maxRetries = 3;

  constructor(props: AgentErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<AgentErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 Agent Error Boundary caught error:', error, errorInfo);
    
    this.setState({
      errorInfo
    });

    // Call the onError callback if provided
    this.props.onError?.(error, errorInfo);

    // Log error details for debugging
    const agentError = AgentErrorHandler.parseError(error, this.props.context, this.props.agent);
    console.error('📊 Parsed agent error:', agentError);
  }

  handleRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      console.log(`🔄 Retrying component render (attempt ${this.state.retryCount + 1}/${this.maxRetries})`);
      
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1
      }));
    }
  };

  handleGoHome = () => {
    // Navigate to home or dashboard
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const canRetry = this.state.retryCount < this.maxRetries;
      const agentError = AgentErrorHandler.parseError(
        this.state.error, 
        this.props.context, 
        this.props.agent
      );

      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <div className="max-w-2xl w-full space-y-6">
            {/* Error Display */}
            <AgentErrorDisplay
              error={this.state.error}
              context={this.props.context}
              agent={this.props.agent}
              showRetryButton={false}
              className="mb-6"
            />

            {/* Error Details for Development */}
            {process.env.NODE_ENV === 'development' && (
              <details className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm">
                <summary className="cursor-pointer font-medium mb-2">
                  🔧 Development Error Details
                </summary>
                <div className="space-y-2">
                  <div>
                    <strong>Error:</strong> {this.state.error.message}
                  </div>
                  <div>
                    <strong>Stack:</strong>
                    <pre className="mt-1 text-xs overflow-auto">
                      {this.state.error.stack}
                    </pre>
                  </div>
                  {this.state.errorInfo && (
                    <div>
                      <strong>Component Stack:</strong>
                      <pre className="mt-1 text-xs overflow-auto">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                  <div>
                    <strong>Retry Count:</strong> {this.state.retryCount}/{this.maxRetries}
                  </div>
                </div>
              </details>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {this.props.showRetryButton !== false && canRetry && (
                <Button
                  onClick={this.handleRetry}
                  variant="default"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try Again ({this.maxRetries - this.state.retryCount} attempts left)
                </Button>
              )}

              {this.props.showHomeButton !== false && (
                <Button
                  onClick={this.handleGoHome}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Home className="h-4 w-4" />
                  Go to Dashboard
                </Button>
              )}

              {!canRetry && (
                <Button
                  onClick={() => window.location.reload()}
                  variant="destructive"
                  className="flex items-center gap-2"
                >
                  <AlertTriangle className="h-4 w-4" />
                  Reload Page
                </Button>
              )}
            </div>

            {/* Additional Help */}
            <div className="text-center text-sm text-muted-foreground">
              <p>
                If this error persists, please{' '}
                <a 
                  href="mailto:support@solairus.com" 
                  className="text-primary hover:underline"
                >
                  contact support
                </a>
                {' '}with the error details above.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC for wrapping components with agent error boundary
 */
export function withAgentErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<AgentErrorBoundaryProps, 'children'>
) {
  const WithErrorBoundary = (props: P) => (
    <AgentErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </AgentErrorBoundary>
  );

  WithErrorBoundary.displayName = `withAgentErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return WithErrorBoundary;
}

/**
 * Hook for programmatically triggering error boundary
 */
export function useAgentErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null);

  const triggerError = React.useCallback((error: Error | string) => {
    const errorObj = error instanceof Error ? error : new Error(error);
    setError(errorObj);
  }, []);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  // Throw error to trigger error boundary
  if (error) {
    throw error;
  }

  return {
    triggerError,
    clearError
  };
}