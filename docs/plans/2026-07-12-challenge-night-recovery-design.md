# Survivor Fantasy League: Challenge-Night Recovery and UI Design

## Goal

Restore `survivor-fantasy-league-pi.vercel.app` and turn the web experience into a focused, cinematic challenge-night app for active league players.

## Production Recovery

The requested hostname currently aliases a duplicate Vercel project named `survivor-fantasy-league`. That project is configured from the repository root with the “Other” framework preset, so its nominally Ready deployments contain no usable web build and return Vercel’s platform-level `404 NOT_FOUND`.

The actual Next.js app is linked to the `web` Vercel project and has healthy public production deployments. Recovery will first attach the requested hostname to a verified healthy Next.js deployment. The project setup will then be consolidated so future production deploys build from `web` with the Next.js preset rather than reintroducing the empty root deployment.

## Experience Direction

The visual direction combines “Night at Tribal” atmosphere with live-competition clarity. Warm black surfaces, controlled firelight, crisp white type, rope and terrain details, and smoky glass challenge panels create drama. The interface will evoke the tone of the television competition without copying official logos, artwork, or trade dress.

Glass is functional rather than universal: it identifies the active challenge surface and high-priority live state. Supporting content uses flatter, quieter surfaces so timer, progress, and primary actions remain dominant.

## Information Architecture

### Shared shell

- Persistent league mark and navigation for Home, Challenge, and Standings.
- A skip link, strong keyboard focus, touch-friendly navigation, and current-route state.
- Ambient firelight and topographic texture implemented with lightweight CSS, with reduced-motion fallbacks.

### Home command center

- Lead with “Tonight’s Challenge” and a direct arena action.
- Explain the challenge format in one glance: ten questions, sixty seconds per question, speed plus accuracy.
- Provide a standings path and concise Discord registration guidance.
- Avoid unverifiable “live” labels or fabricated game data.

### Challenge flow

- Pre-game briefing with visible username label, rules, inline validation, and a clear start action.
- Active challenge with a broadcast-style scorebug: question count, remaining time, and visible progress.
- Large answer targets with letter markers, hover/focus/active states, and immediate selection feedback.
- Correct scoring that includes the final answer and derives the speed bonus from actual answer time.
- Submission state and a result screen that explains score composition and whether score saving succeeded.
- Recoverable Supabase errors; play remains possible even if persistence is unavailable.

### Standings cast board

- Separate active and eliminated players with strong status hierarchy.
- Show immunity and tribe as readable text badges, not color alone.
- Loading skeleton, useful empty state, explicit error state, and retry action.
- Responsive rows that retain all critical status information on narrow screens.

## Data and State

The challenge remains client-side and uses the existing static question set. Each submitted answer records its selected option and time remaining. Completion calculates score from the complete answer set before attempting persistence. Supabase is initialized only when public credentials are available; missing configuration or failed requests produce an in-app status message rather than crashing the route.

Standings fetch player records from Supabase on first render and on explicit retry. Fetch state is modeled as loading, ready, empty, or error so every outcome has a designed presentation.

## Accessibility and Responsive Behavior

- Warm-white body text and semantic surface colors meet WCAG AA contrast targets.
- All controls have visible `:focus-visible` treatment and at least 44px touch targets.
- Form labels remain visible; error messages use `aria-describedby` and an `aria-live` region.
- Timer and progress do not rely on color alone.
- Motion is limited to transforms and opacity and is removed or reduced under `prefers-reduced-motion`.
- Mobile layouts prioritize the timer, question, and answer controls without hiding functionality.

## Verification

1. Run lint and production build with the installed Next.js version.
2. Verify home, challenge, and standings locally at mobile and desktop sizes.
3. Exercise username validation, answering, final-question scoring, result persistence status, standings loading/error behavior, keyboard navigation, and route navigation.
4. Deploy a preview or verified production artifact.
5. Attach the requested production alias only after the deployed app returns a healthy response.
6. Re-check the public hostname, key routes, browser console, and Vercel runtime logs.

