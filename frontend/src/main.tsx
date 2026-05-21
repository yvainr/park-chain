import React from "react";
import { createRoot } from "react-dom/client";

function App() {
  return <main>ParkChain frontend scaffold</main>;
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

