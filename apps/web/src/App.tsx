import { Route, Routes } from "react-router-dom";

function Home() {
  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui" }}>
      <h1>Welcome to SellSnap</h1>
      <p>Sell in a snap — the fastest way for creators to sell digital products online.</p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
    </Routes>
  );
}
