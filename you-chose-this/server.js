/**
 * server.js — WebSocket bridge between joystick.js (Raspberry Pi GPIO)
 * and the browser frontend (index.html).
 *
 * Usage:
 *   npm install ws
 *   node server.js
 *
 * Browser connects to  ws://localhost:3000       (default path)
 * joystick.js connects to  ws://localhost:3000/joystick
 */

'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = 3000;

// ── HTTP server (serves index.html) ──────────────────────────────
const httpServer = http.createServer((req, res) => {
  if (req.method !== 'GET') {
    res.writeHead(405);
    return res.end();
  }

  const filePath = path.join(__dirname, 'index.html');
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
});

// ── WebSocket server ──────────────────────────────────────────────
const wss = new WebSocketServer({ server: httpServer });

const browsers  = new Set();
let joystickWs  = null;

wss.on('connection', (ws, req) => {
  const isJoystick = req.url === '/joystick';

  if (isJoystick) {
    joystickWs = ws;
    console.log('[joystick] connected');

    ws.on('message', data => {
      // Forward every joystick event to all connected browser tabs
      const msg = data.toString();
      browsers.forEach(b => {
        if (b.readyState === 1 /* OPEN */) b.send(msg);
      });
    });

    ws.on('close', () => {
      joystickWs = null;
      console.log('[joystick] disconnected');
    });

    ws.on('error', err => console.error('[joystick] error:', err.message));
    return;
  }

  // Browser client
  browsers.add(ws);
  console.log(`[browser] connected  (total: ${browsers.size})`);

  ws.on('close', () => {
    browsers.delete(ws);
    console.log(`[browser] disconnected  (total: ${browsers.size})`);
  });

  ws.on('error', err => console.error('[browser] error:', err.message));
});

// ── Start ─────────────────────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`You Chose This — server listening on http://localhost:${PORT}`);
  console.log('Open that URL in Chromium / any browser to play.');
  console.log('Start joystick.js separately to connect GPIO input.');
});
