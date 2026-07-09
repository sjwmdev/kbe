import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { ServerErrorPage } from "../pages/ServerErrorPage";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// React error boundaries must be class components — there is no hook
// equivalent. Catches render/lifecycle crashes anywhere below it and shows
// the 500 page instead of a blank white screen.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled error caught by ErrorBoundary:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return <ServerErrorPage onRetry={() => window.location.reload()} />;
    }
    return this.props.children;
  }
}
