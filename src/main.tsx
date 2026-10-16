// Kalam (Google Fonts), served locally – needed for PNG/PDF export without third-party servers
import "@fontsource/kalam/latin-400.css";
import "@fontsource/kalam/latin-700.css";
import "@fontsource/kalam/latin-ext-400.css";
import "@fontsource/kalam/latin-ext-700.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
