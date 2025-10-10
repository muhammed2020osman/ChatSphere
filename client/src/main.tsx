import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerServiceWorker, checkForPWAInstall } from "./lib/pwa";

// Register PWA service worker
registerServiceWorker();

// Check for PWA install prompt
checkForPWAInstall();

createRoot(document.getElementById("root")!).render(<App />);
