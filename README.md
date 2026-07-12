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

The current schema is managed by `supabase/migrations`. Its core ownership model is:

```sql
create table games (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  discord_guild_id text,
  status text not null default 'setup',
  official_challenge_slug text not null default 'fire-signal-cipher'
);

create table players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  discord_id text not null,
  username text not null,
  avatar_url text,
  tribe text,
  is_eliminated boolean default false,
  has_immunity boolean default false,
  created_at timestamp default now(),
  unique (game_id, discord_id)
);

create table votes (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  voter_id text not null,
  target_id text not null,
  tribal_council_id text not null,
  created_at timestamp default now()
);

create table challenges (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  challenge_type text not null,
  player_id text not null,
  score int not null,
  completed_at timestamp default now()
);
```

### 3. Environment Variables

Copy `.env.example` to `.env` and fill in:
- `DISCORD_TOKEN` — from Discord Developer Portal
- `DISCORD_CLIENT_ID` — Application ID from Discord
- `ANTHROPIC_API_KEY` — from Anthropic Console
- `SUPABASE_URL` — from Supabase project settings
- `SUPABASE_ANON_KEY` — from Supabase API settings
- `WEB_APP_URL` — public web URL used in season links

### 4. Install & Run

```bash
npm install
npm run dev
```

## Commands

**Players:**
- `/register` — Join the game
- `/challenge` — Get link to current challenge
- `/vote @player` — Vote someone out at Tribal Council
- `/standings` — See who's still in

**Host:**
- `/newgame code name` — Create a season for this Discord server
- `/startgame` — Start the season and reveal Challenge
- `/endgame` — Close the season and preserve final standings
- `/results` — Show challenge scores and grant immunity (top 3)
- `/tribal` — Reveal votes and eliminate player

## How to Play

1. Host creates a server-specific season with `/newgame`
2. Players open its link or enter its game code on the web
3. Players use `/register` to join
4. Host runs `/startgame`, then posts `/challenge`
5. Host runs `/results` → Claude narrates winner, grants immunity
6. Players use `/vote @player` for Tribal Council
7. Host runs `/tribal` → Claude dramatically reveals elimination
8. Repeat until final 3

## Architecture

- **Discord Bot** — Game command center (registration, voting, announcements)
- **Web Platform** (Next.js) — Challenge arena (trivia game)
- **Claude AI** — Refs challenges, narrates results, tallies votes
- **Supabase** — Game state, player records, challenge scores

## Demo-Ready Checklist

✅ Discord bot with slash commands
✅ Web challenge platform (trivia)
✅ Claude AI narration (challenge results + tribal council)
✅ Immunity system
✅ Vote tallying
✅ Player elimination
✅ Standings page

## Next Steps

- [ ] Deploy web platform to Vercel
- [ ] Set up production Supabase
- [ ] Create Discord server and install bot
- [ ] Add more challenge types
- [ ] Tribe assignments
- [ ] Jury system for final vote
