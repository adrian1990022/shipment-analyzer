import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { initSentry } from "./lib/sentry";
import { registerServiceWorker } from "./lib/registerServiceWorker";
import "./styles.css";

initSentry();
registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
