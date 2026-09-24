"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#f5f6fb",
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: "100%",
            background: "#fff",
            borderRadius: 16,
            padding: 32,
            textAlign: "center",
            border: "1px solid #e2e8f0",
            boxShadow: "0 12px 32px -18px rgba(15,23,42,.35)",
          }}
        >
          <div style={{ fontSize: 34 }}>🎓</div>
          <h1 style={{ fontSize: 18, margin: "12px 0 6px", color: "#0f172a" }}>
            Vidya Analytics is starting up
          </h1>
          <p style={{ fontSize: 14, color: "#475569", margin: 0, lineHeight: 1.6 }}>
            The server was still warming up when this page loaded. Reload and it should come straight
            up.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 20,
              width: "100%",
              padding: "10px 16px",
              borderRadius: 12,
              border: "none",
              cursor: "pointer",
              color: "#fff",
              fontSize: 14,
              fontWeight: 500,
              background: "linear-gradient(90deg,#4f46e5,#7c3aed)",
            }}
          >
            Reload page
          </button>
          {error.digest ? (
            <p style={{ marginTop: 12, fontSize: 11, color: "#94a3b8" }}>Ref: {error.digest}</p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
