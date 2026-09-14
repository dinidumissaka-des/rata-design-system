import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@rata/css/index.css";
// The five accent options, each scoped to [data-rata-theme="<slug>"].
// Loaded after the base tokens so their overrides win; which one applies
// is decided at runtime by the attribute, not by import order.
import "@rata/theme-pine/theme.css";
import "@rata/theme-lime/theme.css";
import "@rata/theme-rust/theme.css";
import "@rata/theme-ink/theme.css";
import "@rata/theme-cobalt/theme.css";
import "./playground.css";
import { App } from "./app.js";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
