import { createBrowserHistory, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createDesignRouter } from "./router.tsx";
import "./index.css";

const router = createDesignRouter(createBrowserHistory());

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("index.html has no #root element");

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
