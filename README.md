# Branice

**Branice** is a premium private multiplayer checkers experience built with React, Tailwind CSS, Framer Motion, Socket.IO, Express, Drizzle, and MySQL. It offers invitation-only six-character rooms, synchronized game state, selectable 8×8, 10×10, and 12×12 boards, mandatory captures, chained jumps, king promotion, responsive controls, and local trophy tracking.

## Included functionality

| Area | Implementation |
| --- | --- |
| Room flow | The host creates a private six-character room. A second player enters that code to claim the opposing side. |
| Live play | Socket.IO broadcasts authoritative room state over a WebSocket-first connection without page reloads. The persisted MySQL room record allows game state to survive reconnects. |
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

`realtime:smoke` starts two Socket.IO clients against a locally running server, creates a room, joins it, and validates a synchronized legal opening move.

## Production deployment

The game works in the development preview and uses a persisted database for room state. For production-grade WebSocket connectivity, configure the project’s managed hosting to use a single always-on instance. This avoids serverless cold starts and keeps Socket.IO room presence stable. The managed always-on option is usage-based, with a maximum compute cost of approximately **$37.50/month** at full 24/7 utilization before the included **$10 monthly usage credit**; network egress is metered separately. Do not enable that hosting option until the account owner reviews the expected cost.

## GitHub handoff

The repository can be pushed from the project root after authenticating the GitHub CLI:

```bash
gh repo create branice --private --source=. --remote=origin --push
```

The project deliberately excludes local environment files. Configure production secrets through the deployment environment rather than committing them to the repository.
