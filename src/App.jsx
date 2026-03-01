import React from "react";
import TradingSimulator from "./TradingSimulator";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gray-950 text-red-500 font-sans text-sm p-8 text-center">
          <div>
            <h1 className="text-xl font-bold mb-4">Simulator Error</h1>
            <p className="opacity-80 break-words max-w-2xl text-gray-400 font-mono text-xs">
              {String(this.state.error)}
            </p>
            <button
              className="mt-6 px-4 py-2 bg-gray-800 text-gray-200 rounded-lg hover:bg-gray-700 transition-colors"
              onClick={() => window.location.reload()}
            >
              Restart Simulator
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <TradingSimulator />
    </ErrorBoundary>
  );
}

export default App;
