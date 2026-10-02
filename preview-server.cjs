const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const root = path.join(__dirname, 'dist');
const backend = 'http://127.0.0.1:8000';
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.ico':'image/x-icon', '.woff2':'font/woff2' };
function staticFile(req, res) {
  let pathname = decodeURIComponent(new URL(req.url, 'http://preview').pathname);
  if (pathname === '/') pathname = '/index.html';
  let file = path.normalize(path.join(root, pathname));
  if (!file.startsWith(root)) return res.writeHead(403).end();
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
  fs.readFile(file, (err, data) => { if (err) return res.writeHead(500).end('Preview unavailable'); res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }); res.end(data); });
}
const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/api/')) {
    try {
      const body = ['GET','HEAD'].includes(req.method) ? undefined : await new Promise((resolve, reject) => { let b=''; req.on('data', c => b += c); req.on('end', () => resolve(b)); req.on('error', reject); });
      const target = await fetch(backend + req.url, { method: req.method, headers: { 'content-type': req.headers['content-type'] || '', authorization: req.headers.authorization || '', 'x-preview-user-id': req.headers['x-preview-user-id'] || '' }, body });
      res.writeHead(target.status, { 'content-type': target.headers.get('content-type') || 'application/json', 'access-control-allow-origin': '*' });
      res.end(Buffer.from(await target.arrayBuffer()));
    } catch (e) { res.writeHead(502, { 'content-type': 'application/json' }).end(JSON.stringify({ detail: 'Backend unavailable' })); }
    return;
  }
  staticFile(req, res);
});
server.listen(8081, '0.0.0.0', () => console.log('Web preview with API proxy on http://0.0.0.0:8081'));
