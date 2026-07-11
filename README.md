# Survivor Fantasy League

AI-hosted online Survivor game. Players compete in challenges on a web platform, vote in Discord, and Claude AI refs the whole thing.

## Setup

### 1. Discord Bot

Create a bot at [discord.com/developers](https://discord.com/developers/applications):
- New Application → Bot → Reset Token (save it)
- Enable "Message Content Intent" under Bot settings
- OAuth2 → URL Generator → Select `bot` and `applications.commands` scopes
- Bot Permissions: Send Messages, Read Messages, Use Slash Commands
- Install bot to your server via the generated URL

### 2. Supabase Database

Run the schema in [`db/schema.sql`](db/schema.sql) in the Supabase SQL editor. It is idempotent and safe to re-run — it creates `game_state`, `players`, `votes`, and `challenges`, and migrates any older tables (e.g. `votes.tribal_council_id` → `votes.round`).

### 3. Environment Variables

Copy `.env.example` to `.env` and fill in:
- `DISCORD_TOKEN` — from Discord Developer Portal
- `DISCORD_CLIENT_ID` — Application ID from Discord
- `ANTHROPIC_API_KEY` — from Anthropic Console
- `SUPABASE_URL` — from Supabase project settings
- `SUPABASE_ANON_KEY` — from Supabase API settings

### 4. Install & Run

```bash
npm install
npm run dev
```

## Commands

**Players:**
- `/register` — Join the game (lobby only)
- `/challenge` — Get link to the current challenge
- `/vote @player` — Vote someone out at Tribal Council (or, in the finale, vote for who you want to **win**)
- `/standings` — See tribes, jury, and who's still in

**Host:**
- `/start` — Assign registered players to two tribes and begin
- `/results` — Show challenge scores and grant immunity (winning tribe pre-merge; top scorer post-merge)
- `/tribal` — Reveal votes and eliminate a player (or read the jury vote and crown the winner)

## Rules

- **18 players, 2 tribes.** Assigned at `/start`.
- **Tribe phase (until 12 remain):** tribes compete; each tribe's scores combine into one total. Winning tribe is immune; the **losing tribe** votes someone out among themselves.
- **Merge at 12:** tribes dissolve, play goes individual. Immunity now goes to the **single top scorer**.
- **Jury:** everyone voted out from the merge onward joins the jury.
- **Final 3:** the jury votes **for** a winner; most votes wins.
- **Ties:** Tribal Council ties → random draw. Jury ties → revote among the tied finalists (fewest-vote finalists dropped).

## How to Play

1. Host creates a Discord server and invites players
2. Players use `/register` to join
3. Host runs `/start` to assign tribes
4. Host posts `/challenge` → players compete on the web
5. Host runs `/results` → Claude narrates and grants immunity
6. Players use `/vote @player` at Tribal Council
7. Host runs `/tribal` → Claude dramatically reveals the elimination and advances the round (announcing the merge / finale when reached)
8. At the final 3, the jury `/vote`s and the host runs `/tribal` to crown the Sole Survivor

## Architecture

- **Discord Bot** — Game command center (registration, voting, announcements)
- **Web Platform** (Next.js) — Challenge arena (trivia game)
- **Claude AI** — Refs challenges, narrates results, tallies votes
- **Supabase** — Game state, player records, challenge scores

## Demo-Ready Checklist

✅ Discord bot with slash commands
✅ Web challenge platform (trivia)
✅ Claude AI narration (challenge results + tribal council + finale)
✅ Phase-based immunity (tribe immunity pre-merge, individual post-merge)
✅ Tribe assignment + merge at 12
✅ Round tracking
✅ Vote tallying with tie-breaks (random draw / jury revote)
✅ Player elimination
✅ Jury system + final vote
✅ Standings page (tribes / jury / winner)

## Next Steps

- [ ] Deploy web platform to Vercel
- [ ] Set up production Supabase
- [ ] Create Discord server and install bot
- [ ] Add more challenge types
- [ ] Real-time collaborative tribe trivia (shared live session; currently tribe scores are aggregated from each member's individual run)
