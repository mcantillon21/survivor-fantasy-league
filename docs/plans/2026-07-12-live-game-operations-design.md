# Live Game Operations Design

## Goal

Make a complete Survivor round work in the existing `Survivor Fantasy` Discord server without renaming or creating channels. Hosts select one official challenge, players receive one valid attempt, votes remain private, Tribal Council reveals the correct tribe, and merge moves play into the existing public camp.

## Existing Discord Contract

The implementation targets these current channels:

- `announcements`
- `standings`
- `camp`
- `challenge-lobby`
- `tribal-council`
- `tribe-red`
- `tribe-blue`
- `ponderosa`
- `spectators`

The roles `Tribe Red` and `Tribe Blue` remain the source of Discord channel access. The database remains the source of game phase, player tribe, immunity, votes, official challenge, and results.

## Commands

### Host commands

- `/newgame code name` creates a setup season.
- `/startgame` makes it live.
- `/challenge game:<choice>` selects one of the 15 challenge slugs as official and posts the season challenge link. Omitting `game` reposts the current official challenge.
- `/results` narrates the current official challenge and grants immunity to the top three distinct registered players.
- `/tribal tribe:<red|blue|merged>` reveals and clears the selected Tribal Council. Before merge, `red` or `blue` is required. After merge, the command resolves to `merged`.
- `/merge` changes `game_state.phase` to `merged`, makes `tribe-red` and `tribe-blue` read-only, and posts the merge announcement in `camp`.
- `/endgame` ends the season and preserves standings.

Every state-changing host command requires Discord's Manage Server permission.

### Player commands

- `/register` joins the current season and refreshes the Discord username/avatar.
- `/vote @player` records one private vote for the player's active Tribal Council. A later vote replaces the earlier vote before reveal.
- `/standings` displays the current season only.

## Official Attempt Boundary

The browser is not authoritative. A Supabase function accepts official submissions and validates all of the following atomically:

1. The game exists and is live.
2. The submitted challenge is still the game's official challenge.
3. The username matches a registered, non-eliminated player case-insensitively.
4. The score is between 0 and 1000.
5. No row already exists for the same game, challenge, and registered player.

The function stores the canonical registered username. A unique index enforces the one-attempt invariant even under simultaneous requests. Direct anonymous inserts into `challenges` are removed; anonymous clients may execute only the validated submission function.

Typed usernames still do not constitute full Discord authentication. This design prevents unregistered names and repeat attempts, including after clearing browser storage. Discord OAuth or signed player tickets can be layered on later if identity impersonation must be cryptographically prevented.

## Voting and Reveal

Before merge, votes are stored under `tribal-red` or `tribal-blue` according to the voter's database tribe. Cross-tribe and immune targets are rejected. `/tribal tribe:red` and `/tribal tribe:blue` reveal only the matching pool.

After merge, every vote is stored under `tribal-merged`; `/tribal tribe:merged` reveals that pool. Ties are reported without eliminating anyone so the host can resolve them deliberately instead of relying on database order.

## Merge Behavior

`/merge` does not expect legacy categories. It finds the existing `tribe-red`, `tribe-blue`, and `camp` channels. It marks both tribe rooms read-only for their matching roles, leaves them visible as archives, updates the database phase, and announces the merge in `camp`. The command is idempotent: running it again returns a clear already-merged message.

## Errors and Recovery

- Missing channels or roles produce a precise host-facing error and do not falsely report a complete merge.
- A database failure does not change Discord permissions.
- A Discord permission failure does not advance the database phase.
- Tribal Council with no votes or a tied top tally does not eliminate a player.
- Duplicate official submissions show “Official attempt already submitted.”
- Unregistered names show “Registered Discord name not found.”
- A changed official challenge shows “This is no longer the official challenge.”

## Verification

Automated checks cover command registration, host authorization, challenge selection, vote pool resolution, immunity/cross-tribe rejection, tie behavior, merge channel edits, database submission validation, duplicate races, lint, unit tests, build, and database lint.

Production verification uses temporary QA games and players, exercises setup/live/merged/ended states, submits an official attempt twice, checks standings isolation, and removes all QA rows. Actual Discord mutations such as locking live channels require action-time user confirmation immediately before the test.
