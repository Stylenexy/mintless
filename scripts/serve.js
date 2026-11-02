// Zero-dependency static server for the game. Run: npm start
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const port = Number(process.env.PORT ?? 5173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const path = decodeURIComponent(url.pathname);
  if (path === "/" || path === "/web") {
    res.writeHead(302, { location: `/web/${url.search}` }).end();
    return;
  }
  const file = normalize(join(root, path));
  if (!file.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const info = await stat(file);
    const target = info.isDirectory() ? join(file, "index.html") : file;
    const body = await readFile(target);
    res.writeHead(200, { "content-type": types[extname(target)] ?? "application/octet-stream", "cache-control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" }).end("not found");
  }
}).listen(port, () => {
  console.log(`Mintless is running: http://localhost:${port}/`);
});
