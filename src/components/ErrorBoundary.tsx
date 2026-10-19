import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallbackTitle?: string;
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
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] bg-red-50 flex flex-col items-center justify-center p-4 rounded-xl border border-red-100 my-4">
          <div className="bg-white p-6 rounded-xl shadow-sm max-w-2xl w-full border border-red-200">
            <h1 className="text-xl font-bold text-red-600 mb-4 flex items-center">
              <svg className="w-6 h-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {this.props.fallbackTitle || "Crash de l'application"}
            </h1>
            <p className="text-gray-700 mb-4 text-sm font-medium">
              Une erreur inattendue s'est produite lors du rendu de cette page. Veuillez prendre une capture d'écran de ce message d'erreur et l'envoyer à Antigravity.
            </p>
            
            <div className="bg-gray-900 rounded-lg p-4 overflow-auto max-h-[40vh]">
              <h3 className="text-red-400 font-mono text-xs font-bold mb-2">Message de l'erreur :</h3>
              <p className="text-white font-mono text-xs mb-4 whitespace-pre-wrap break-all">
                {this.state.error && this.state.error.toString()}
              </p>
              
              <h3 className="text-red-400 font-mono text-xs font-bold mb-2">Composant (Stack Trace) :</h3>
              <p className="text-gray-300 font-mono text-[10px] whitespace-pre-wrap break-all">
                {this.state.errorInfo && this.state.errorInfo.componentStack}
              </p>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button 
                onClick={() => window.location.reload()}
                className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm"
              >
                Rafraîchir la page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
