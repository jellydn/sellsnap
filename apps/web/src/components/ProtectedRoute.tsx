import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { authClient } from "../lib/auth";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isPending && !session) {
      navigate("/sign-in");
    }
  }, [session, isPending, navigate]);

  if (isPending) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "200px",
        }}
      >
        <span>Loading...</span>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return <>{children}</>;
}
