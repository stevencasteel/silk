import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("[ErrorBoundary] HUD crashed:", error, info.componentStack);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(10,12,18,0.95)",
            color: "#ef4444",
            fontFamily: "monospace",
            fontSize: "12px",
            padding: "20px",
            textAlign: "center",
            zIndex: 100
          }}
        >
          <div>
            <div style={{ fontWeight: "bold", marginBottom: "8px" }}>
              HUD RENDER ERROR
            </div>
            <div style={{ color: "#a1a1aa", fontSize: "10px" }}>
              {this.state.error?.message ?? "Unknown error"}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
