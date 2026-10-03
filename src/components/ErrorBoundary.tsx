"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // Technical details stay in the console/Sentry; users only see a generic message
    // (see PART 9, Question 5 of the spec).
    console.error("UI error boundary caught:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="card m-4 text-center">
            <p className="font-medium">Something went wrong.</p>
            <p className="mt-1 text-sm text-foreground-secondary">
              Please refresh the page and try again.
            </p>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
