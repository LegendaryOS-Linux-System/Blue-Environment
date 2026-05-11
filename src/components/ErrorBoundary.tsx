import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';

interface Props { children: ReactNode; appId?: string; appTitle?: string; onClose?: () => void; }
interface State { hasError: boolean; error: Error | null; errorInfo: ErrorInfo | null; showDetails: boolean; }

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null, showDetails: false };
    }
    static getDerivedStateFromError(error: Error): Partial<State> { return { hasError: true, error }; }
    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        this.setState({ errorInfo });
        window.dispatchEvent(new CustomEvent('blue:show-toast', {
            detail: { id: Date.now().toString(), title: `${this.props.appTitle || 'App'} crashed`, message: error.message }
        }));
    }
    handleRestart = () => this.setState({ hasError: false, error: null, errorInfo: null, showDetails: false });
    render() {
        if (!this.state.hasError) return this.props.children;
        return (
            <div className="flex flex-col items-center justify-center h-full bg-slate-900 text-white p-6">
                <div className="max-w-md w-full">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                            <AlertTriangle size={20} className="text-red-400" />
                        </div>
                        <div>
                            <h2 className="font-bold">{this.props.appTitle} stopped working</h2>
                            <p className="text-xs text-slate-400">The application crashed unexpectedly</p>
                        </div>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4">
                        <p className="text-red-300 text-sm font-mono break-all">{this.state.error?.message}</p>
                    </div>
                    <div className="flex gap-2 mb-4">
                        <button onClick={this.handleRestart} className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm">
                            <RefreshCw size={14} /> Restart App
                        </button>
                        {this.props.onClose && (
                            <button onClick={this.props.onClose} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg text-sm">
                                <X size={14} /> Close
                            </button>
                        )}
                    </div>
                    <p className="text-xs text-slate-600 text-center">Only this app crashed — your desktop is fine.</p>
                </div>
            </div>
        );
    }
}
export default ErrorBoundary;
