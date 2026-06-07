'use strict';

const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const WebSocket = require('ws');

const WS_URL   = 'ws://localhost:3000/joystick';
const SERIAL   = '/dev/cu.usbserial-10';
const BAUD     = 9600;

let ws;

function connectWS() {
  ws = new WebSocket(WS_URL);
  ws.on('open',  () => console.log('[joystick] WebSocket connected'));
  ws.on('close', () => { console.log('[joystick] reconnecting...'); setTimeout(connectWS, 3000); });
  ws.on('error', () => {});
}

function send(action) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ action }));
  }
}

connectWS();

const port = new SerialPort({ path: SERIAL, baudRate: BAUD });
const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

parser.on('data', line => {
  const msg = line.trim();
  if (msg === 'LEFT')   send('LEFT');
  if (msg === 'RIGHT')  send('RIGHT');
  if (msg === 'UP')     send('UP');
  if (msg === 'DOWN')   send('DOWN');
  if (msg === 'PRESS')  send('SELECT');
});

port.on('error', err => console.error('[serial] error:', err.message));

process.on('SIGINT',  () => { port.close(); process.exit(0); });
process.on('SIGTERM', () => { port.close(); process.exit(0); });