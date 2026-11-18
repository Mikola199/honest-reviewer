import express from "express";
import { handleMcpRequest } from "./mcp.js";

const app = express();
const port = Number(process.env.PORT ?? 3000);
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000")
  .split(",").map(value => value.trim()).filter(Boolean);

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

app.use((req, res, next) => {
  const origin = req.header("origin");
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "content-type, mcp-session-id, last-event-id");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true, service: "honest-reviewer-mcp", version: "0.3.0" }));

app.post("/mcp", async (req, res, next) => {
  try { await handleMcpRequest(req, res); } catch (error) { next(error); }
});

// This first cut intentionally exposes no write route or generic GitHub proxy.
app.all("/mcp", (req, res) => res.status(405).json({ error: "Only MCP POST requests are enabled in this stateless starter." }));

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Internal server error.";
  // Do not return upstream headers, tokens, or stack traces.
  res.status(500).json({ error: message });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Honest Reviewer MCP listening on port ${port}`);
});
