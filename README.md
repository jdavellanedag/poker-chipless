# Poker Chipless

A real-time chipless poker manager for casual home games. No physical chips needed — the host runs a local server, players join from their own devices.

## Quick Start

```bash
npm install
npm run build
npm run start
```

The server prints `Serving on http://<your-ip>:3000` on startup. Share that URL with your players.

## Development

```bash
npm install
npm run dev   # starts client dev server (port 5173) + server (port 3000) in watch mode
```

## Notes

> **Session codes:** Two simultaneous game creations could theoretically generate the same code; restart the server to generate a new one.
