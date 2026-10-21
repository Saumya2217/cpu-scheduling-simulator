// Simple static HTTP server using built-in Node.js modules (no dependencies required)
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.csv': 'text/csv',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  // Normalize URL to prevent path traversal
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);
  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  }

  const safePath = path.normalize(path.join(ROOT_DIR, pathname));

  // Ensure request is inside ROOT_DIR
  if (!safePath.startsWith(ROOT_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(safePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(safePath).pipe(res);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n======================================================`);
  console.log(`CPU Scheduling Simulator running at http://localhost:${PORT}`);
  console.log(`Press Ctrl+C to stop.`);
  console.log(`======================================================\n`);
});
