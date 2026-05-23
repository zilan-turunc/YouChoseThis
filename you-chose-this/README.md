# You Chose This

An interactive word-selection art piece. Words float across a dark screen; the participant selects one per level using a joystick (or keyboard). Their choices and reaction speeds generate a unique abstract artwork that is revealed at the end.

---

## Quick start — desktop browser (no server needed)

```
open you-chose-this/index.html          # macOS
start you-chose-this/index.html         # Windows
xdg-open you-chose-this/index.html      # Linux
```

Or simply drag `index.html` into any modern browser.

**Keyboard controls**

| Action           | Key             |
|------------------|-----------------|
| Start / skip     | Any key         |
| Move cursor left | ← Arrow         |
| Move cursor right| → Arrow         |
| Select word      | Enter or Space  |

---

## Running with the Node.js WebSocket server

Use this mode on the Raspberry Pi (or for local testing with joystick hardware).

### 1. Install dependencies

```bash
cd you-chose-this
npm install ws
```

### 2. Start the server

```bash
node server.js
```

Open `http://localhost:3000` in Chromium. The server also serves `index.html`, so no separate static host is needed.

---

## Raspberry Pi deployment

### Hardware requirements

- Raspberry Pi 3B+ / 4 / Zero 2W
- Standard 2-axis analog joystick module with push-button
- MCP3008 8-channel ADC (for reading the analog X-axis)
- HDMI display or TV
- MicroSD card (≥ 8 GB, Raspberry Pi OS Lite recommended)

### Wiring diagram

```
Joystick pin   →   Pi / MCP3008
───────────────────────────────
VCC            →   Pi 3.3 V (pin 1)
GND            →   Pi GND  (pin 6)
VRx (X-axis)   →   MCP3008 CH0
SW  (button)   →   Pi GPIO 17 (BCM) + 10 kΩ pull-up to 3.3 V

MCP3008 pin    →   Pi
───────────────────────────────
VDD            →   3.3 V
VREF           →   3.3 V
AGND           →   GND
CLK            →   GPIO 11 (SCLK, SPI0)
DOUT           →   GPIO 9  (MISO, SPI0)
DIN            →   GPIO 10 (MOSI, SPI0)
CS/SHDN        →   GPIO 8  (CE0,  SPI0)
DGND           →   GND
```

### Pi OS setup

```bash
# Enable SPI in raspi-config → Interface Options → SPI → Enable
sudo raspi-config

# Update and install Node.js (v20 LTS)
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs chromium-browser

# Install npm dependencies
cd ~/you-chose-this
npm install ws onoff spi-device
```

### Running on the Pi

Open **three** terminals (or use `tmux`):

```bash
# Terminal 1 — game server
node server.js

# Terminal 2 — joystick GPIO listener
node joystick.js

# Terminal 3 — browser in kiosk mode
chromium-browser --kiosk --noerrdialogs --disable-infobars \
  --app=http://localhost:3000
```

### Auto-start on boot with systemd

Create two service files:

**`/etc/systemd/system/you-chose-this.service`**
```ini
[Unit]
Description=You Chose This — game server
After=network.target

[Service]
WorkingDirectory=/home/pi/you-chose-this
ExecStart=/usr/bin/node server.js
Restart=always
User=pi

[Install]
WantedBy=multi-user.target
```

**`/etc/systemd/system/joystick.service`**
```ini
[Unit]
Description=You Chose This — joystick bridge
After=you-chose-this.service

[Service]
WorkingDirectory=/home/pi/you-chose-this
ExecStart=/usr/bin/node joystick.js
Restart=always
User=pi

[Install]
WantedBy=multi-user.target
```

**`/etc/systemd/system/kiosk.service`**
```ini
[Unit]
Description=You Chose This — Chromium kiosk
After=graphical.target you-chose-this.service

[Service]
Environment=DISPLAY=:0
ExecStartPre=/bin/sleep 4
ExecStart=/usr/bin/chromium-browser --kiosk --noerrdialogs \
          --disable-infobars --app=http://localhost:3000
Restart=on-failure
User=pi

[Install]
WantedBy=graphical.target
```

Enable all three:

```bash
sudo systemctl enable you-chose-this joystick kiosk
sudo systemctl start  you-chose-this joystick kiosk
```

### Auto-start with pm2 (alternative)

```bash
sudo npm install -g pm2
pm2 start server.js   --name game-server
pm2 start joystick.js --name joystick
pm2 save
pm2 startup           # follow the printed command to enable on boot
```

---

## Data & artwork export

At the end of the session the reveal screen shows two buttons:

- **Export Data** — downloads `choices.json` containing every selection with level, word, category, colour, reaction time, and timestamp.
- **Save Artwork** — downloads `artwork.png`, the generative canvas built from your choices.

Move saved files into the `../artwork/` folder to keep them alongside other session outputs.

Choices are also persisted automatically to `localStorage` under the key `you-chose-this`.

---

## File structure

```
you-chose-this/
├── index.html     Game — fully self-contained, works as file:// or via server
├── server.js      Node.js HTTP + WebSocket bridge (Pi deployment)
├── joystick.js    GPIO listener — runs on Raspberry Pi
└── README.md      This file

artwork/           Folder for exported artwork PNGs and choices JSON files
```

---

## Adjusting timing & feel

Inside `index.html`, near the top of the `<script>`, a config block lets you tune:

| Constant       | Default | Effect                                   |
|----------------|---------|------------------------------------------|
| `WORD_SPEED`   | `62`    | Pixels per second the words scroll       |
| `SPAWN_MIN`    | `650`   | Minimum ms between word spawns           |
| `SPAWN_MAX`    | `1350`  | Maximum ms between word spawns           |
| `NUM_LANES`    | `10`    | Number of vertical tracks                |

Decrease `WORD_SPEED` and increase spawn intervals for a more meditative pace; increase speed and tighten intervals for more pressure.
