import { createRoot } from "react-dom/client";
import App from "./app/App";
import "./styles/index.css";

declare global {
  interface Window {
    recaptchaVerifier: any;
  }
}

createRoot(document.getElementById("root")!).render(<App />);
