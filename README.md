# Branice😘

**Branice😘** is a premium private multiplayer checkers experience built with React, Tailwind CSS, Framer Motion, Socket.IO, Express, Drizzle, and MySQL. It offers invitation-only six-character rooms, synchronized game state, selectable 8×8, 10×10, and 12×12 boards, mandatory captures, chained jumps, king promotion, responsive controls, and local trophy tracking.

## Included functionality

| Area | Implementation |
| --- | --- |
| Room flow | The host creates a private six-character room. A second player enters that code to claim the opposing side. |
| Live play | The game persists authoritative room state in MySQL and refreshes it automatically in the background, so both players stay synchronized without page reloads even when a browser or deployment blocks WebSocket upgrades. Socket.IO remains available where the transport supports it. |
| Player access | Players create an account or sign in using **email and password only**. Passwords are salted and hashed server-side; session cookies protect room API access. |
| Official play rules | The rules engine enforces diagonal movement, compulsory captures, multi-jump continuations, promotion at the far edge, and backward moves for kings only. |
| Visual design | The interface uses a dark obsidian base, neon-violet primary accent, warm ember opponent color, procedural wooden-board texture, glossy pieces, and accessible status indicators. |
| End state | Automatic win detection activates a trophy-and-confetti overlay. Per-device wins are retained in `localStorage`. |
| Accessibility | Board cells have descriptive labels, controls retain visible focus states, and nonessential animation is suppressed for users who request reduced motion. |

## Local development

Install dependencies and run the development server:

```bash
pnpm install
pnpm dev
```

The project expects its standard managed database and OAuth environment variables. No third-party API key is needed for the Socket.IO room service.

When making a new schema change, generate and review a Drizzle migration before applying it to the database:

```bash
pnpm drizzle-kit generate
```

## Verification

The codebase includes test coverage for opening-piece counts, forced captures, multi-jumps, promotion, king back-moves, and room-role authorization.

```bash
pnpm check
pnpm test
pnpm realtime:smoke
```

`auth-room:smoke` registers two temporary test accounts, confirms session-cookie sign-in, creates and joins a protected room, validates a synchronized legal opening move, and verifies anonymous room access is rejected.

## Production deployment

The repository includes a lowercase `vercel.json` with the Vite framework, `npm install`, `npm run build`, and the generated `dist/public` output directory already defined. Import the GitHub repository into Vercel and leave the project settings at their detected defaults; no manual build-command or output-directory setup is required.

The frontend build is verified with `npm run build`. The repository also includes `api/[...path].ts`, which exposes the existing Express/tRPC credential and room procedures as a Vercel serverless function. Add the existing database and application environment variables in Vercel’s environment store; no code or build-setting changes are required. Socket.IO presence is optional because the client falls back to persisted room-state polling.

The game works in the development preview and uses persisted room state plus automatic background synchronization, so it works on the default managed deployment without requiring a persistent WebSocket process. For sub-second WebSocket presence at higher scale, configure the project’s managed hosting to use a single always-on instance. This is optional and usage-based, with a maximum compute cost of approximately **$37.50/month** at full 24/7 utilization before the included **$10 monthly usage credit**; network egress is metered separately.

## App shortcut

Branice includes a web app manifest, service worker, mobile app icon, and two installed-app shortcuts: **Create room** and **Join room**. In Chromium browsers, the **Install app** control appears when the browser has accepted the installation criteria. On iOS Safari, use **Share → Add to Home Screen**; the manifest supplies the Branice😘 name, theme, and app icon.

## GitHub handoff

The repository can be pushed from the project root after authenticating the GitHub CLI:

```bash
gh repo create branice --private --source=. --remote=origin --push
```

The project deliberately excludes local environment files. Configure production secrets through the deployment environment rather than committing them to the repository.
