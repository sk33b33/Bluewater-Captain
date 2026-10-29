// Tiny static server for the e2e tests: serves dist/ over http://127.0.0.1 like a real deployment.
// (file:// pages get inconsistent localStorage across reloads in headless Chromium.)
const http = require('http');
const fs = require('fs');
const path = require('path');

exports.startServer = () => new Promise((resolve) => {
  const file = path.resolve(__dirname, '../../dist/index.html');
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(fs.readFileSync(file));
  });
  server.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${server.address().port}/`, close: () => server.close() }));
});
