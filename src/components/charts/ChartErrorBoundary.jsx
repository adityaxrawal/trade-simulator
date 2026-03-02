import React from "react";

class ChartErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && this.props.resetKey !== prevProps.resetKey) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(error, errorInfo) {
    console.error("Chart Render Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-gray-900 border border-red-800/50 rounded-xl p-5 text-center text-red-400">
          <p className="text-sm font-semibold mb-2">Failed to render chart</p>
          <p className="text-xs text-gray-500">
            The current simulation parameters triggered a rendering error.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ChartErrorBoundary;
