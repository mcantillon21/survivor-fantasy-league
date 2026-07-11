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

Create tables:

```sql
-- Players table
create table players (
  id uuid primary key default gen_random_uuid(),
  discord_id text unique not null,
  username text not null,
  tribe text,
  is_eliminated boolean default false,
  has_immunity boolean default false,
  created_at timestamp default now()
);

-- Votes table
create table votes (
  id uuid primary key default gen_random_uuid(),
  voter_id text not null,
  target_id text not null,
  tribal_council_id int not null,
  created_at timestamp default now()
);

-- Challenges table
create table challenges (
  id uuid primary key default gen_random_uuid(),
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

### 4. Install & Run

```bash
npm install
npm run dev
```

## Commands

- `/register` — Join the game
- `/challenge` — Get link to current challenge
- `/vote @player` — Vote someone out
- `/standings` — See who's still in

## Architecture

- **Discord Bot** — Game command center (registration, voting, announcements)
- **Web Platform** (Next.js) — Challenge arena where players compete
- **Claude AI** — Refs challenges, tallies votes, narrates eliminations
- **Supabase** — Game state, player records, votes

## Next Steps

- [ ] Build web challenge platform (Next.js)
- [ ] Add Claude referee logic (challenge scoring, vote tallying)
- [ ] Create first challenge (Survivor trivia)
- [ ] Automate tribal council vote reveals
- [ ] Add tribe assignments
