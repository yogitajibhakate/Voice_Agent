const http = require('http');
const net = require('net');

const FRONTEND_PORT = 3001; // Next.js runs on 3001
const BACKEND_PORT = 8000;  // FastAPI runs on 8000
const PROXY_PORT = 3000;    // Public entrypoint (Cloudflared forwards to 3000)

const server = http.createServer((req, res) => {
  const isApi = req.url.startsWith('/api/v1');
  const targetPort = isApi ? BACKEND_PORT : FRONTEND_PORT;

  const headers = { ...req.headers };
  if (isApi) {
    headers.host = 'localhost:8000';
  }

  const options = {
    hostname: '127.0.0.1',
    port: targetPort,
    path: req.url,
    method: req.method,
    headers: headers,
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    console.error(`HTTP Proxy Error [${req.url}]:`, err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('Bad Gateway');
    }
  });

  req.pipe(proxyReq, { end: true });
});

server.on('upgrade', (req, socket, head) => {
  const isApi = req.url.startsWith('/api/v1');
  const targetPort = isApi ? BACKEND_PORT : FRONTEND_PORT;

  console.log(`[Proxy WS Upgrade] ${req.url} -> port ${targetPort}`);

  const targetSocket = net.connect(targetPort, '127.0.0.1', () => {
    let reqHeaders = `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`;
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      const key = req.rawHeaders[i];
      let val = req.rawHeaders[i + 1];
      if (key.toLowerCase() === 'host' && isApi) {
        val = 'localhost:8000';
      }
      reqHeaders += `${key}: ${val}\r\n`;
    }
    reqHeaders += '\r\n';

    targetSocket.write(reqHeaders);
    if (head && head.length) {
      targetSocket.write(head);
    }
    targetSocket.pipe(socket);
    socket.pipe(targetSocket);
    socket.resume();
  });

  targetSocket.on('error', (err) => {
    console.error(`[Proxy WS Error] ${req.url}:`, err.message);
    socket.destroy();
  });

  socket.on('error', (err) => {
    console.error(`[Proxy Incoming Socket Error] ${req.url}:`, err.message);
    targetSocket.destroy();
  });
});

server.listen(PROXY_PORT, '0.0.0.0', () => {
  console.log(`[Proxy] Listening on port ${PROXY_PORT} (Next.js:${FRONTEND_PORT}, FastAPI:${BACKEND_PORT})`);
});
