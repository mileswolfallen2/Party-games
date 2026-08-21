const http = require("http");
const fs = require("fs");
const path = require("path");
const { countJar } = require("./public/lib/counter");

const PORT = process.env.PORT || 6897;
const PUBLIC_DIR = path.join(__dirname, "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*"
  });
  res.end(body);
}

function readBody(req, limit = 30 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", c => {
      size += c.length;
      if (size > limit) {
        reject(new Error("payload too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function handleAPI(req, res, url) {
  if (url.pathname === "/api/health" && req.method === "GET") {
    return sendJSON(res, 200, { ok: true, games: ["count-the-jar", "poker"] });
  }

  if (url.pathname === "/api/count-jar" && req.method === "POST") {
    try {
      const raw = await readBody(req);
      const payload = JSON.parse(raw.toString("utf8"));
      const width = payload.width | 0;
      const height = payload.height | 0;
      if (!width || !height || width * height * 4 > 4_000_000) {
        return sendJSON(res, 400, { error: "invalid image dimensions" });
      }
      let data;
      if (typeof payload.data === "string") {
        data = Buffer.from(payload.data, "base64");
      } else if (Array.isArray(payload.data)) {
        data = Buffer.from(payload.data);
      } else {
        return sendJSON(res, 400, { error: "missing RGBA data" });
      }
      if (data.length !== width * height * 4) {
        return sendJSON(res, 400, { error: `expected ${width * height * 4} bytes, got ${data.length}` });
      }
      const t0 = Date.now();
      const result = countJar({ width, height, data }, payload.options || {});
      result.ms = Date.now() - t0;
      return sendJSON(res, 200, result);
    } catch (err) {
      return sendJSON(res, 400, { error: err.message });
    }
  }

  sendJSON(res, 404, { error: "not found" });
}

function serveStatic(req, res, url) {
  let rel = decodeURIComponent(url.pathname);
  if (rel === "/") rel = "/index.html";
  const abs = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!abs.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("forbidden");
  }
  fs.readFile(abs, (err, buf) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("404 not found");
    }
    res.writeHead(200, { "Content-Type": MIME[path.extname(abs)] || "application/octet-stream" });
    res.end(buf);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/api/")) {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      });
      return res.end();
    }
    handleAPI(req, res, url).catch(() => sendJSON(res, 500, { error: "internal error" }));
    return;
  }
  if (req.method !== "GET") {
    res.writeHead(405);
    return res.end();
  }
  serveStatic(req, res, url);
});

server.listen(PORT, () => {
  console.log(`Party Games running at http://localhost:${PORT}`);
});
