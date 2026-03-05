import { Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { SignIn } from "./pages/SignIn";
import { SignUp } from "./pages/SignUp";

function Home() {
  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui" }}>
      <h1>Welcome to SellSnap</h1>
      <p>Sell in a snap — the fastest way for creators to sell digital products online.</p>
    </div>
  );
}

function Dashboard() {
  return (
    <div style={{ padding: "2rem" }}>
      <h1>Dashboard</h1>
      <p>Your products will appear here.</p>
    </div>
  );
}

export default function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/sign-up" element={<SignUp />} />
        <Route path="/sign-in" element={<SignIn />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </AppLayout>
  );
}
