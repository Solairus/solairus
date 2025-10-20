/**
 * Admin Error Boundary
 * 
 * Purpose: Catch and handle React errors in admin components
 * 
 * Features:
 * - Graceful error handling with user-friendly messages
 * - Error reporting and logging
 * - Recovery mechanisms
 * - Fallback UI components
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, RefreshCw, Home, Bug } from 'lucide-react';
import { AdminErrorHandler } from '@/utils/admin-error-handler';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  errorId: string;
}

export class AdminErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorId: '',
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: `admin-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Log error details
    console.error('Admin Error Boundary caught an error:', error);
    console.error('Error Info:', errorInfo);

    // Parse error for better handling
    const adminError = AdminErrorHandler.parseError(error, 'Admin Interface');
    console.error('Parsed Admin Error:', adminError);

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Report error to monitoring service (if available)
    this.reportError(error, errorInfo, adminError);
  }

  private reportError = (error: Error, errorInfo: ErrorInfo, adminError: any) => {
    // In a real application, you would send this to your error monitoring service
    const errorReport = {
      id: this.state.errorId,
      timestamp: new Date().toISOString(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      errorInfo: {
        componentStack: errorInfo.componentStack,
      },
      adminError,
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // Log to console for development
    console.error('Error Report:', errorReport);

    // TODO: Send to error monitoring service
    // Example: Sentry.captureException(error, { extra: errorReport });
  };

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      errorId: '',
    });
  };

  private handleGoHome = () => {
    window.location.href = '/dapp';
  };

  private handleReportBug = () => {
    const errorDetails = {
      id: this.state.errorId,
      error: this.state.error?.message,
      stack: this.state.error?.stack,
      component: this.state.errorInfo?.componentStack,
    };

    const subject = encodeURIComponent(`Admin Interface Error - ${this.state.errorId}`);
    const body = encodeURIComponent(`
Error ID: ${this.state.errorId}
Timestamp: ${new Date().toISOString()}

Error Details:
${JSON.stringify(errorDetails, null, 2)}

Please describe what you were doing when this error occurred:
[Your description here]
    `);

    // Open email client or support form
    window.open(`mailto:support@example.com?subject=${subject}&body=${body}`);
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl bg-gray-900/50 border-gray-800">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <AlertTriangle className="h-16 w-16 text-red-400" />
              </div>
              <CardTitle className="text-2xl text-white">
                Something went wrong
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert className="border-red-800 bg-red-900/20">
                <AlertTriangle className="h-4 w-4 text-red-400" />
                <AlertDescription className="text-red-300">
                  The admin interface encountered an unexpected error. This has been logged for investigation.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="text-sm text-gray-400">
                  <strong>Error ID:</strong> {this.state.errorId}
                </div>
                
                {this.state.error && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-gray-300 hover:text-white">
                      Technical Details
                    </summary>
                    <div className="mt-2 p-3 bg-gray-800 rounded border border-gray-700">
                      <div className="text-red-400 font-mono text-xs break-all">
                        {this.state.error.message}
                      </div>
                      {this.state.error.stack && (
                        <pre className="mt-2 text-gray-500 font-mono text-xs overflow-auto max-h-32">
                          {this.state.error.stack}
                        </pre>
                      )}
                    </div>
                  </details>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={this.handleRetry}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                
                <Button
                  onClick={this.handleGoHome}
                  variant="outline"
                  className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800"
                >
                  <Home className="h-4 w-4 mr-2" />
                  Go to Dashboard
                </Button>
                
                <Button
                  onClick={this.handleReportBug}
                  variant="outline"
                  className="flex-1 border-gray-600 text-gray-300 hover:bg-gray-800"
                >
                  <Bug className="h-4 w-4 mr-2" />
                  Report Issue
                </Button>
              </div>

              <div className="text-xs text-gray-500 text-center">
                If this problem persists, please contact support with the error ID above.
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC to wrap components with error boundary
 */
export function withAdminErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WrappedComponent(props: P) {
    return (
      <AdminErrorBoundary fallback={fallback}>
        <Component {...props} />
      </AdminErrorBoundary>
    );
  };
}

/**
 * Hook to manually trigger error boundary
 */
export function useErrorBoundary() {
  const [, setState] = React.useState();

  return React.useCallback((error: Error) => {
    setState(() => {
      throw error;
    });
  }, []);
}