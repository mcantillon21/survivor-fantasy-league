# Multi-Season Game Rooms

## Goal

Support multiple Survivor games at the same time while keeping every season's players, standings, votes, immunity, and challenge scores isolated.

## Public lobby

The public `/` route becomes a neutral entry lobby. It retains the symmetric torch hero and adds a compact official Survivor logo lockup above the heading. The centered glass pane contains a game-code field instead of an immediate challenge action. A valid code routes to the matching season; invalid and ended codes receive clear states.

## Season routes and navigation

Every game uses a stable public code:

- `/game/[code]` — season home and status
- `/game/[code]/challenge` — that season's challenge vault
- `/game/[code]/challenge/[slug]` — season-scoped challenge runner
- `/game/[code]/standings` — that season's cast only

The Challenge navigation item is hidden while the season is in setup and appears when the overall season becomes live. Standings remain available inside the season context. Legacy `/challenge` and `/standings` routes return visitors to the public lobby instead of exposing global data.

## Data model

Add a `games` table with an ID, unique code, display name, Discord guild ID, status (`setup`, `live`, or `ended`), official challenge slug, and timestamps. Add `game_id` references to players, votes, challenges, and game state. Replace global uniqueness assumptions with game-scoped uniqueness, especially `(game_id, discord_id)` for players.

The migration creates one default game and assigns every existing player, vote, challenge score, and game-state row to it. No current league data is deleted.

## Discord flow

- `/newgame` creates or replaces the setup season associated with the current Discord server.
- `/startgame` makes that server's season live.
- `/endgame` closes it.
- `/register`, `/challenge`, `/results`, `/vote`, `/tribal`, `/standings`, and `/merge` resolve the active game from the Discord guild and scope every query by `game_id`.
- `/challenge` posts the unique season challenge URL.

One current season is supported per Discord server, while any number of separate Discord servers can run concurrently.

## Challenge behavior

The official challenge is stored per game. Practice challenges remain available after the season starts but never write scores. Official scores include `game_id`, and the browser attempt key also includes the game code so the same person can participate independently in different seasons.

## Failure states

Missing or invalid codes return a concise not-found state. Setup seasons explain that the host has not started the game. Ended seasons show final standings but do not permit challenge attempts. Bot commands reject missing or non-live season state with an actionable message.

## Verification

Test the migration against current data, create two independent games, register and score players in both, and verify isolation across the web and Discord query layer. Run lint, unit tests, production build, browser verification, Computer Use verification, deployment checks, and a Vercel error scan.
