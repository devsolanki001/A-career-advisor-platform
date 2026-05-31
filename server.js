import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

import { buildCareerPrompt, extractJsonObject, validateCareerReport } from "./src/report.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(__dirname, "public");
const port = Number(process.env.PORT || 3000);
const model = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_200_000) {
        reject(new Error("Profile is too large. Keep the pasted text under 1 MB."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function getGeminiText(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts.map((part) => part.text).filter(Boolean).join("\n").trim();

  if (!text) {
    const reason = data?.candidates?.[0]?.finishReason || "empty response";
    throw new Error(`Gemini returned no report text (${reason}).`);
  }

  return text;
}

async function analyzeProfile(payload) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY;

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY. Set it before running the server.");
  }

  if (!payload.profileText || payload.profileText.trim().length < 80) {
    throw new Error("Add more resume/profile text so CareerLens can analyze real evidence.");
  }

  const prompt = buildCareerPrompt(payload);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.35,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = data?.error?.message || `Gemini request failed with HTTP ${response.status}.`;
    throw new Error(message);
  }

  const report = extractJsonObject(getGeminiText(data));
  return validateCareerReport(report);
}

async function serveStatic(req, res) {
  const requestedPath = req.url === "/" ? "/index.html" : new URL(req.url, "http://localhost").pathname;
  const safePath = normalize(requestedPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(publicDir, safePath);

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const file = await readFile(filePath);
    res.writeHead(200, { "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream" });
    res.end(file);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/analyze-profile") {
    try {
      const rawBody = await readRequestBody(req);
      const payload = JSON.parse(rawBody || "{}");
      const report = await analyzeProfile(payload);
      sendJson(res, 200, { report });
    } catch (error) {
      sendJson(res, 400, { error: error.message || "Unable to analyze profile." });
    }
    return;
  }

  if (req.method === "GET") {
    await serveStatic(req, res);
    return;
  }

  sendJson(res, 405, { error: "Method not allowed." });
});

server.listen(port, () => {
  console.log(`CareerLens AI running at http://localhost:${port}`);
});
