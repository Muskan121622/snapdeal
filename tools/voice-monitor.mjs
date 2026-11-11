// Local voice-call monitor. The frontend (dev only) POSTs events here; each event
// is printed as one readable line so it can be tailed live from the terminal.
// Run: node tools/voice-monitor.mjs   (listens on 0.0.0.0:5174)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG = path.join(__dirname, 'voice-monitor.log');
const PORT = 5174;

fs.writeFileSync(LOG, '');

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const clip = (s, n) => (s.length > n ? s.slice(0, n) + ' …[clipped]' : s);

function fmt(evt) {
  const ts = new Date().toISOString().slice(11, 23);
  switch (evt.type) {
    case 'turn':
      return `[${ts}] TURN   seller="${clean(evt.seller)}"   kam="${clean(evt.kam)}"`;
    case 'tool-call':
      return `[${ts}] CALL   ${evt.name}(${clean(JSON.stringify(evt.args ?? {}))})`;
    case 'tool-response':
      return `[${ts}] RESP   ${evt.name} -> ${clip(clean(JSON.stringify(evt.response)), 1600)}`;
    case 'audio':
      return `[${ts}] AUDIO  KAM voice output playing`;
    case 'interrupted':
      return `[${ts}] BARGE-IN  seller interrupted the KAM`;
    case 'ws-open':
      return `[${ts}] WS     opened — session live`;
    case 'ws-close':
      return `[${ts}] WS     closed`;
    case 'ws-error':
      return `[${ts}] WS-ERROR  ${clean(evt.message)}`;
    case 'connect-error':
      return `[${ts}] CONNECT-ERROR  ${clean(evt.message)}`;
    case 'mic-start':
      return `[${ts}] MIC    capture started (16kHz PCM streaming to Gemini)`;
    case 'mic-error':
      return `[${ts}] MIC-ERROR  ${clean(evt.message)}`;
    case 'status':
      return `[${ts}] STATUS ${clean(evt.status)}`;
    case 'prompt':
      return `[${ts}] SENT   proactive opening prompt to KAM`;
    default:
      return `[${ts}] ${evt.type} ${clean(JSON.stringify(evt))}`;
  }
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/log') {
    let body = '';
    req.on('data', (c) => {
      body += c;
      if (body.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      let evt;
      try {
        evt = JSON.parse(body);
      } catch {
        evt = { type: 'raw', body };
      }
      const line = fmt(evt);
      fs.appendFileSync(LOG, line + '\n');
      process.stdout.write(line + '\n');
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
    });
    return;
  }

  if (req.method === 'GET' && (req.url === '/' || req.url === '/log')) {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(fs.readFileSync(LOG, 'utf8'));
    return;
  }

  res.writeHead(404);
  res.end('not found');
});

server.on('error', (e) => {
  process.stdout.write(`MONITOR SERVER ERROR: ${e.message}\n`);
  process.exit(1);
});

server.listen(PORT, '0.0.0.0', () => {
  process.stdout.write(`Voice monitor listening on http://localhost:${PORT} — waiting for call events…\n`);
});