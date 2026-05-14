# Poker Chipless

A real-time chipless poker manager for casual home games. No physical chips needed — the host runs a local Node.js server on their laptop, and players join from their phones or any browser on the same Wi-Fi network.

Texas Hold'em only. The app handles all chip tracking, blind posting, bet validation, and turn order. The host controls pacing (deal, advance rounds, declare winner).

---

## Requirements

- **Node.js** v20 or later (LTS recommended)
- **npm** v10 or later
- All players on the **same local network** (Wi-Fi or wired)

---

## Running the App (Production Mode)

This is the recommended mode for an actual game night.

```bash
# 1. Install dependencies (first time only)
npm install

# 2. Build the app
npm run build

# 3. Start the server
npm run start
```

On startup the server prints something like:

```
Serving on http://192.168.1.42:3000
```

That IP is your machine's local network address. Share it with your players — they open it in any browser on their phone or laptop.

---

## Starting a Game

### Host

1. Open `http://localhost:3000` in your browser.
2. Enter your display name and click **Create Game**.
3. A 6-character session code appears (e.g. `K7MN4P`). Share it with your players verbally or over chat.
4. Wait for everyone to join — their names appear in the lobby as they connect.
5. When everyone is in, configure the starting stack and blinds, then click **Start Game**.

### Players

1. Open the host's URL (e.g. `http://192.168.1.42:3000`) in your browser.
2. Click **Join Game**, enter the session code and your display name, then tap **Join**.
3. You land in the lobby. Wait for the host to start the game.

---

## Playing a Hand

The game follows standard Texas Hold'em structure. The host drives pacing; players act on their turn.

| Who | Action |
|-----|--------|
| Host | Click **New Hand** to deal. Blinds are posted automatically. |
| Active player | Choose from the actions shown: Fold, Check, Call, Bet, Raise, All-In. |
| Host | Click **Advance Round** after each betting round (Flop → Turn → River → Showdown). |
| Host | At showdown, click **Declare Winner** next to the winning player's name. The pot transfers to their stack. |
| Host | Click **New Hand** to start the next round. |

**Eliminations** — a player with 0 chips is marked eliminated. The host can issue a **Rebuy** from the host overlay at any time.

**Pausing** — the host can pause and resume the game from the overlay. If the host disconnects, the game pauses automatically and resumes when they reconnect.

---

## Reconnecting

If you accidentally close or refresh your browser, reopen the URL and re-enter your name — the game will restore your seat.

---

## Development Mode

For working on the code — runs the Vite dev server (port 5173) and the Socket.IO server (port 3000) side-by-side with hot reload.

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser. Socket.IO traffic is proxied from 5173 → 3000 automatically.

Run the test suite:

```bash
npm test --workspace=@poker-chipless/server
```

---

## Notes

> **Session codes:** Two simultaneous game creations could theoretically generate the same code; restart the server to generate a new one.

> **LAN only:** The server is not exposed to the internet. All players must be on the same Wi-Fi or local network as the host machine.

> **Capacitor compatibility (v2 audit):** The client uses no `window.location` reloads, no non-standard `navigator` APIs, and no Web Bluetooth/NFC/Serial. The Socket.IO connection uses a relative URL (`io()` with no explicit host), which is compatible with Capacitor's webview origin. No Capacitor plugins are required for the current feature set.
