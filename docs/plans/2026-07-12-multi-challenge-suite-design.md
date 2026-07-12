# Survivor Fantasy League: Multi-Challenge Suite

## Goal

Expand the challenge arena from a single trivia game into a rotating challenge vault with one official competition at a time and twelve additional practice-ready games.

## Product Model

The `/challenge` route becomes the Challenge Vault. It identifies one catalog entry as the official challenge and labels every other game as Practice. Official attempts require the registered Discord username, persist a normalized score, and are locally locked after completion. Practice attempts remain replayable and never affect official results.

The initial official challenge is Fire Signal Cipher. Rotation is config-driven so launch does not depend on a production database migration. The Discord `/challenge` command continues to point to the vault, where the official game is always the primary action.

## Architecture

The suite uses a shared runner and modular game engines:

- A challenge catalog defines identity, description, difficulty, expected duration, visual accent, rules, scoring speed weight, and official status.
- A shared runner owns briefing, player check-in, official/practice mode, attempt timing, score normalization, result persistence, and result presentation.
- Each game engine owns only its mechanics and raw performance score.
- Pure shared logic supplies seeded randomness, cipher transforms, score clamping, sequence generation, and maze helpers.
- Dynamic `/challenge/[slug]` routes render the appropriate engine while keeping the interaction shell consistent.

This avoids a single brittle component and avoids duplicating the timer, persistence, accessibility, and result flows across thirteen pages.

## Challenge Catalog

1. Existing Survivor Strategy Trivia
2. Fire Signal Cipher
3. Idol Lockbox
4. Torchlight Labyrinth
5. Memory Totem
6. Island Coordinates
7. Chain Reaction
8. Supply Drop
9. Risk the Flame
10. Tribal Pulse
11. Oath of Attention
12. Survivor Gauntlet
13. Command From Camp

## Scoring

Every official result is normalized to an integer from 0–1,000 so the existing Discord results ranking can compare different game types. Engines award raw performance based on correct decisions and apply explicit mistake or move penalties. The runner then applies a challenge-specific elapsed-time penalty. Practice results show the same score calculation but are not written to Supabase.

The existing `challenges` table remains compatible: `challenge_type` stores the game slug, `player_id` stores the Discord username, and `score` stores the normalized score.

## Fairness and Recovery

- Seeded variants reduce direct answer sharing while maintaining equivalent difficulty.
- Official attempts store their start timestamp and engine progress in local storage, so reloads do not reset the timer or restore a clean board.
- Completed official attempts are locally locked, with Practice still available.
- The UI labels this as a lightweight league safeguard rather than claiming tamper-proof security.
- Supabase failures do not erase the final score; the result remains visible with a clear screenshot instruction for the host.

## Interaction and Accessibility

All engines use native buttons, inputs, labels, status regions, and keyboard-operable controls. Mobile targets remain at least 44px. Timed games avoid announcing every second to screen readers. Color is never the only carrier of correctness or state. Motion is optional under `prefers-reduced-motion`.

The existing firelit visual system remains, with each engine receiving a distinct functional accent and board composition inside the smoky challenge surface.

## Error Handling

- Unknown slugs render the route not-found state.
- Invalid or incomplete actions produce inline guidance.
- Official score persistence exposes saving, saved, unavailable, and failed states.
- Corrupt local progress is discarded safely while retaining the original attempt start time when possible.
- Timers and scheduled prompts clean up on navigation and completion.

## Verification

1. Pure logic tests cover score bounds, deterministic seeded output, cipher transforms, and maze validity.
2. ESLint, TypeScript, and the optimized Next.js production build must pass.
3. Browser verifies the hub plus every engine’s completion path, official/practice separation, persistence, keyboard behavior, and responsive layouts.
4. Computer Use independently checks the rendered app visually and operates representative games through the real UI.
5. Production verification checks the public URL, all dynamic challenge routes, live Supabase standings, and Vercel error logs.

