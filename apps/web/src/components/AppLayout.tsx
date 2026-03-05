import { Link, useNavigate } from "react-router-dom";
import { authClient } from "../lib/auth";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await authClient.signOut();
    navigate("/sign-in");
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          borderBottom: "1px solid #e5e7eb",
          padding: "1rem 2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Link
          to="/"
          style={{
            fontSize: "1.25rem",
            fontWeight: 700,
            textDecoration: "none",
            color: "#111",
          }}
        >
          SellSnap
        </Link>
        <nav style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          {isPending ? (
            <span style={{ color: "#6b7280" }}>Loading...</span>
          ) : session ? (
            <>
              <Link
                to="/dashboard/settings"
                style={{
                  color: "#2563eb",
                  textDecoration: "none",
                  fontSize: "0.875rem",
                }}
              >
                Settings
              </Link>
              <span style={{ color: "#374151" }}>{session.user.name}</span>
              <button
                type="button"
                onClick={handleSignOut}
                style={{
                  padding: "0.5rem 1rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.375rem",
                  background: "white",
                  cursor: "pointer",
                  fontSize: "0.875rem",
                }}
              >
                Sign Out
              </button>
            </>
          ) : (
            <Link
              to="/sign-in"
              style={{
                color: "#2563eb",
                textDecoration: "none",
                fontSize: "0.875rem",
              }}
            >
              Sign In
            </Link>
          )}
        </nav>
      </header>
      <main style={{ flex: 1 }}>{children}</main>
    </div>
  );
}
