---
status: in-progress
---

# README & Single-Command Setup

> **Status:** `in-progress`

## Clarification
_No open questions._

## Context
Fourteenth and final issue, M5 — Polish. Builds on everything. The host is a non-DevOps person who needs to get a game running in under 2 minutes. This issue makes that possible with clear setup docs and a single command.

## Goal
A complete README covering prerequisites, one-command install and start, how to share the server URL with players, and key caveats. Running `npm install && npm run dev` from the repo root starts the full stack.

## Acceptance Criteria
- [ ] `README.md` at the repo root covers: prerequisites (Node.js version, npm version), install (`npm install`), dev mode (`npm run dev`), production mode (`npm run build && npm run start`).
- [ ] README explains that on startup the terminal prints the local IP URL (e.g. `http://192.168.1.42:3000`) and instructs the host to share that URL with players.
- [ ] README includes the session code collision caveat: "In the unlikely event two game sessions on the same network share a code, restart the server to generate a new one."
- [ ] README covers the reconnection flow: "If you accidentally close or refresh your browser, reopen the URL and re-enter your name — the game will restore your seat."
- [ ] `npm run dev` starts both client and server from the repo root via Turborepo with a single command; no manual split-terminal setup required.
- [ ] `npm run build` produces a production build of both client and server; `npm run start` serves the app on port 3000 with the client served as static files.
- [ ] Node.js minimum version requirement is documented and enforced via `engines` field in the root `package.json`.
- [ ] A `.nvmrc` or `.node-version` file is present at the repo root specifying the Node.js version.

## Technical Notes
- Recommended Node.js version: 20 LTS (active LTS as of 2026).
- `npm run dev` Turborepo pipeline: `client#dev` depends on `types#build`; `server#dev` depends on `types#build`. Both app dev tasks run in parallel after types builds.
- `npm run start` is a root-level script that runs `node apps/server/dist/index.js` — the server serves the pre-built client from `apps/client/dist`.
- Keep the README concise — it is for a non-technical host, not a contributor guide. No architecture diagrams or contributor guidelines needed in v1.

## Out of Scope
- Docker or containerised deployment instructions.
- CI/CD pipeline setup.
- Contributing guide or code of conduct.
- Cloud deployment instructions (v2).
