import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signOut, useSession } from "../lib/session";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { data: session } = useSession();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/sign-in");
  };

  return (
    <div>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "1rem 2rem",
          borderBottom: "1px solid #e5e7eb",
          backgroundColor: "white",
        }}
      >
        <Link
          to="/"
          style={{
            fontSize: "1.25rem",
            fontWeight: "bold",
            textDecoration: "none",
            color: "#2563eb",
          }}
        >
          SellSnap
        </Link>
        <nav style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          {session ? (
            <>
              <span style={{ color: "#374151" }}>{session.user.name || session.user.email}</span>
              <button
                type="button"
                onClick={handleSignOut}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "transparent",
                  border: "1px solid #d1d5db",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                Sign Out
              </button>
            </>
          ) : (
            <Link to="/sign-in" style={{ color: "#2563eb", textDecoration: "none" }}>
              Sign In
            </Link>
          )}
        </nav>
      </header>
      <main style={{ padding: "2rem" }}>{children}</main>
    </div>
  );
}
