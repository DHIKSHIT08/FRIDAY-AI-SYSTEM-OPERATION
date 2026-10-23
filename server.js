const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.join(__dirname, 'public');
const STATE_FILE = path.join(__dirname, 'data', 'demo-state.json');
const PHASES = new Set(['Ground', 'Climb', 'Cruise', 'Descent', 'Approach']);

const aircraftInfo = {
  name: 'Boeing 787 Dreamliner',
  checkedOn: '2026-10-22',
  description: 'A family of twin-engine, long-haul widebody passenger aircraft. Boeing describes the 787 as designed for efficiency, route flexibility, and passenger comfort.',
  variants: [
    { model: '787-8', seatsTwoClass: '200–275', maxTakeoffWeightKg: 227930, rangeNmi: 8000, rangeKm: 14820, lengthM: 56.7, wingspanM: 60.1, heightM: 16.9 },
    { model: '787-9', seatsTwoClass: '250–325', maxTakeoffWeightKg: 259220, rangeNmi: 8300, rangeKm: 15370, lengthM: 62.8, wingspanM: 60.1, heightM: 17.0 },
    { model: '787-10', seatsTwoClass: '300–375', maxTakeoffWeightKg: 260360, rangeNmi: 7500, rangeKm: 13890, lengthM: 68.3, wingspanM: 60.1, heightM: 17.0 }
  ],
  engines: ['GE Aerospace GEnx-1B', 'Rolls-Royce Trent 1000'],
  designNotes: [
    'Boeing says the airframe is about 50% composite by weight.',
    'Boeing describes electronically dimmable windows and a cabin altitude of about 6,000 ft as passenger-comfort features.',
    'Boeing states that the 787 uses 25% less fuel than the airplanes it typically replaces; this is a manufacturer comparison, not a guarantee for every route or operator.'
  ],
  sources: [
    { title: 'Boeing 787 Dreamliner: specifications', url: 'https://www.boeing.com/commercial/787' },
    { title: 'Boeing 787 Dreamliner by design', url: 'https://www.boeing.com/commercial/787/by-design' }
  ],
  disclaimer: 'Published family-level specifications and manufacturer claims are for general information. Airline configuration and operating conditions vary. The demo telemetry is fictional and is not 787 operating data.'
};

function defaultState() {
  const now = new Date().toLocaleTimeString('en-US', { hour12: false });
  return {
    phase: 'Cruise', altitudeFt: 35000, speedKt: 489, fuelPercent: 72,
    events: [
      { id: 'evt-source', severity: 'NOTICE', title: 'SIMULATED DATA SOURCE ACTIVE', source: 'Demo environment', time: 'Now', status: 'Open' },
      { id: 'evt-telemetry', severity: 'INFO', title: 'LOCAL TELEMETRY LOOP STARTED', source: 'Simulation engine', time: now, status: 'Acknowledged' },
      { id: 'evt-check', severity: 'INFO', title: 'INTERFACE SELF-CHECK COMPLETED', source: 'Application', time: now, status: 'Acknowledged' },
      { id: 'evt-report', severity: 'INFO', title: 'REPORT EXPORT AVAILABLE', source: 'Reporting module', time: now, status: 'Acknowledged' }
    ],
    logs: [
      { time: now, title: 'Simulation self-check completed', detail: 'Demo application ready; values are illustrative.' },
      { time: now, title: 'Backend storage initialized', detail: 'Demo state is saved locally on this computer.' },
      { time: now, title: 'Dashboard session started', detail: 'No aircraft connection is configured.' }
    ],
    history: [{ alt: 35000, speed: 489, fuel: 72 }],
    updatedAt: new Date().toISOString()
  };
}

async function readState() {
  try { return JSON.parse(await fs.readFile(STATE_FILE, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const state = defaultState();
    await writeState(state);
    return state;
  }
}

let writeQueue = Promise.resolve();
function writeState(state) {
  writeQueue = writeQueue.then(async () => {
    await fs.mkdir(path.dirname(STATE_FILE), { recursive: true });
    const tempFile = `${STATE_FILE}.${process.pid}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(state, null, 2), 'utf8');
    await fs.rename(tempFile, STATE_FILE);
  });
  return writeQueue;
}

function normalizeState(input) {
  const base = defaultState();
  const numberOr = (value, fallback, min, max) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  };
  const text = (value, fallback = '') => String(value ?? fallback).slice(0, 300);
  const events = Array.isArray(input.events) ? input.events.slice(0, 100).map((event, index) => ({
    id: text(event.id, `evt-${index}`), severity: text(event.severity, 'INFO'),
    title: text(event.title), source: text(event.source), time: text(event.time),
    status: event.status === 'Acknowledged' ? 'Acknowledged' : 'Open'
  })) : base.events;
  const logs = Array.isArray(input.logs) ? input.logs.slice(0, 200).map(log => ({
    time: text(log.time), title: text(log.title), detail: text(log.detail)
  })) : base.logs;
  const history = Array.isArray(input.history) ? input.history.slice(-60).map(point => ({
    alt: numberOr(point.alt, 35000, 0, 60000),
    speed: numberOr(point.speed, 0, 0, 700),
    fuel: numberOr(point.fuel, 0, 0, 100)
  })) : base.history;
  return {
    phase: PHASES.has(input.phase) ? input.phase : base.phase,
    altitudeFt: numberOr(input.altitudeFt, base.altitudeFt, 0, 60000),
    speedKt: numberOr(input.speedKt, base.speedKt, 0, 700),
    fuelPercent: numberOr(input.fuelPercent, base.fuelPercent, 0, 100),
    events, logs, history, updatedAt: new Date().toISOString()
  };
}

function sendJson(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) throw new Error('Request body is too large.');
  }
  return JSON.parse(body || '{}');
}

async function serveFile(request, response, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.resolve(PUBLIC_DIR, `.${requested}`);
  const relative = path.relative(PUBLIC_DIR, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    response.writeHead(403); response.end('Forbidden'); return;
  }
  try {
    const body = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
    response.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    if (request.method === 'HEAD') response.end(); else response.end(body);
  } catch (error) {
    if (error.code === 'ENOENT') { response.writeHead(404); response.end('Not found'); return; }
    throw error;
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    if (url.pathname === '/api/health' && request.method === 'GET') {
      sendJson(response, 200, { ok: true, service: 'Friday AI demo backend', storage: 'local JSON file' }); return;
    }
    if (url.pathname === '/api/state' && request.method === 'GET') {
      sendJson(response, 200, await readState()); return;
    }
    if (url.pathname === '/api/state' && request.method === 'PUT') {
      const state = normalizeState(await readJson(request));
      await writeState(state);
      sendJson(response, 200, { ok: true, updatedAt: state.updatedAt }); return;
    }
    if (url.pathname === '/api/aircraft/787' && request.method === 'GET') {
      sendJson(response, 200, aircraftInfo); return;
    }
    if (url.pathname.startsWith('/api/')) {
      sendJson(response, 404, { error: 'API route not found' }); return;
    }
    if (request.method === 'GET' || request.method === 'HEAD') {
      await serveFile(request, response, decodeURIComponent(url.pathname)); return;
    }
    response.writeHead(405); response.end('Method not allowed');
  } catch (error) {
    const status = error instanceof SyntaxError ? 400 : 500;
    sendJson(response, status, { error: status === 400 ? 'Invalid JSON request body' : 'Backend error' });
  }
});

server.listen(PORT, '0.0.0.0', () => {


  
  console.log(`Friday AI demo is running at http://127.0.0.1:${PORT}`);
  console.log('Local demo backend only. No aircraft or external network connection is used.');
});
