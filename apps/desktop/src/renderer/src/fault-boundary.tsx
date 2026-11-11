import { Component, type ErrorInfo, type ReactNode } from "react";

interface FaultBoundaryProps {
  children: ReactNode;
}

interface FaultBoundaryState {
  error: Error | null;
}

/** Replaces the window with the error screen when a component throws while drawing. */
export class FaultBoundary extends Component<
  FaultBoundaryProps,
  FaultBoundaryState
> {
  override state: FaultBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): FaultBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info.componentStack);
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="fault-screen">
        <div className="fault">
          <h1>Perch stopped drawing this window</h1>
          <p className="what">
            A component failed while drawing. The error below is from the
            renderer.
          </p>
          <p className="message">{`${error.name}: ${error.message}`}</p>
          <pre>{error.stack}</pre>
          <button type="button" onClick={() => location.reload()}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}
