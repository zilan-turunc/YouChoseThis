/**
 * joystick.js — Raspberry Pi GPIO listener for a 2-axis joystick + button.
 *
 * Hardware assumed:
 *   • Joystick X-axis (VRx) → MCP3008 ADC channel 0 via SPI0
 *   • Joystick button (SW)  → GPIO 17 (BCM), active-low with pull-up
 *
 * Dependencies:
 *   npm install ws onoff spi-device
 *
 * Run on the Pi *after* server.js is running:
 *   node joystick.js
 */

'use strict';

const WebSocket = require('ws');

// ── Config ────────────────────────────────────────────────────────
const WS_URL          = 'ws://localhost:3000/joystick';
const POLL_MS         = 80;    // how often to read the analog axis
const LEFT_THRESHOLD  = 380;   // below this (0–1023) = LEFT
const RIGHT_THRESHOLD = 645;   // above this           = RIGHT
const BUTTON_PIN      = 17;    // BCM GPIO pin for joystick SW
const SPI_BUS         = 0;
const SPI_DEVICE_NUM  = 0;
const ADC_CHANNEL     = 0;     // MCP3008 channel connected to VRx

// ── WebSocket connection ──────────────────────────────────────────
let ws;

function connectWS() {
  ws = new WebSocket(WS_URL);

  ws.on('open', () => {
    console.log('[joystick] WebSocket connected to server');
  });

  ws.on('close', () => {
    console.log('[joystick] WebSocket closed — retrying in 3 s…');
    setTimeout(connectWS, 3000);
  });

  ws.on('error', () => {});
}

function send(action) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ action }));
  }
}

connectWS();

// ── Button (digital, active-low) ─────────────────────────────────
let button;
try {
  const { Gpio } = require('onoff');
  button = new Gpio(BUTTON_PIN, 'in', 'falling', { debounceTimeout: 60 });
  button.watch((err) => {
    if (!err) send('SELECT');
  });
  console.log(`[joystick] Button watching GPIO ${BUTTON_PIN}`);
} catch (e) {
  console.warn('[joystick] onoff unavailable — button disabled:', e.message);
}

// ── X-axis (analog via MCP3008 over SPI) ─────────────────────────
let spiDevice;
try {
  const SPI = require('spi-device');
  spiDevice = SPI.openSync(SPI_BUS, SPI_DEVICE_NUM, { mode: SPI.MODE0, maxSpeedHz: 1_000_000 });
  console.log(`[joystick] SPI${SPI_BUS}.${SPI_DEVICE_NUM} opened for MCP3008`);
} catch (e) {
  console.warn('[joystick] spi-device unavailable — analog axis disabled:', e.message);
}

function readAdc(channel) {
  // MCP3008 single-ended read protocol (3-byte SPI transfer)
  const msg = [{
    sendBuffer:    Buffer.from([0x01, (0x08 + channel) << 4, 0x00]),
    receiveBuffer: Buffer.alloc(3),
    byteLength:    3
  }];
  spiDevice.transferSync(msg);
  return ((msg[0].receiveBuffer[1] & 0x03) << 8) | msg[0].receiveBuffer[2];
}

let lastDir = null;

if (spiDevice) {
  setInterval(() => {
    try {
      const val = readAdc(ADC_CHANNEL);

      if (val < LEFT_THRESHOLD) {
        if (lastDir !== 'LEFT') { send('LEFT'); lastDir = 'LEFT'; }
      } else if (val > RIGHT_THRESHOLD) {
        if (lastDir !== 'RIGHT') { send('RIGHT'); lastDir = 'RIGHT'; }
      } else {
        lastDir = null; // joystick returned to center
      }
    } catch (e) {
      // SPI read failure — silently skip this tick
    }
  }, POLL_MS);
}

// ── Cleanup on exit ───────────────────────────────────────────────
function cleanup() {
  if (button)    { try { button.unexport(); } catch (_) {} }
  if (spiDevice) { try { spiDevice.closeSync(); } catch (_) {} }
  process.exit(0);
}

process.on('SIGINT',  cleanup);
process.on('SIGTERM', cleanup);
