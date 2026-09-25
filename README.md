# Sidequest

**Mobile companion for Cursor agent wait time.** Grok + Cursor Hackathon, 2026-09-25.

You send a prompt in Cursor. Your phone buzzes within a second with a challenge sized to the predicted run length: 20 squats, a one-question Grok quiz about what the agent is building, or a 60-second tap-reflex game. The moment the agent finishes, the phone buzzes again with a one-line summary of what changed, so you walk back ready to review. Nothing is guessed: Cursor hooks give exact start and stop signals.

```mermaid
flowchart LR
  subgraph desktop [Developer machine]
    Cursor -->|beforeSubmitPrompt / postToolUse / afterFileEdit / afterAgentThought / stop| HookScript["~/.cursor/hooks/sidequest.sh"]
  end
  HookScript -->|"POST /events (fire-and-forget, 1s cap)"| Relay["server/ (Fastify + ws + SQLite)"]
  Relay -->|xAI API| Grok["Grok: challenge text, progress note, done summary"]
  Relay -->|Expo Push| Push[Expo push service]
  Relay <-->|WebSocket live state| Phone["mobile/ (Expo)"]
  Push --> Phone
```

## Layout

| Path | What |
| --- | --- |
| `hooks/` | Cursor user hook (`hooks.json` + `sidequest.sh`) and `install.sh` |
| `server/` | Relay: run state machine, duration predictor, Grok content, pairing, push |
| `mobile/` | Expo app: pairing, live run screen, challenges, stats |
| `shared/events.ts` | Types shared by all three |

## Quick start

Requirements: Node 22.9+, `curl` and `jq` on the machine running Cursor, a phone with [Expo Go](https://expo.dev/go) on the same Wi-Fi.

### 1. Relay

```bash
cd server
npm install
cp .env.example .env      # add XAI_API_KEY for Grok content (optional)
npm start
```

The relay prints a QR code, its LAN URL (e.g. `http://192.168.1.20:4747`) and a 6-digit pairing code. `GET /pair-qr` serves the same QR as a web page. Set `PAIR_CODE=123456` in `.env` to keep the code stable across restarts.

### 2. Cursor hook

```bash
./hooks/install.sh                        # relay on this machine
./hooks/install.sh http://192.168.1.20:4747   # relay elsewhere
```

This copies `sidequest.sh` to `~/.cursor/hooks/`, writes `~/.cursor/sidequest.env` with the relay URL, and merges the five Sidequest entries into `~/.cursor/hooks.json` (existing hooks are preserved). Cursor reloads `hooks.json` on save; check the **Hooks** output channel if events do not show up.

The hook is fail-open: it backgrounds a `curl` with a 1-second cap and always exits 0, so a stopped relay never slows or blocks the agent.

### 3. Phone

```bash
cd mobile
npm install
npx expo start
```

Open the project in Expo Go, tap **Scan QR code** and point it at the relay's QR (or type the address and code). Pick a challenge mode on the home screen:

- **Move**: exercise from a fixed list, reps scaled to about two thirds of the predicted wait. Grok only writes the one-liner.
- **Quiz**: one Grok multiple-choice question derived from the prompt and project; the answer and explanation are revealed when the agent stops.
- **Game**: tap-reflex, freezes the instant the agent finishes.
- **Mixed**: rotates.

### 4. Demo without Cursor

```bash
cd server
npm run simulate -- 25    # replays a 25-second fake agent run
```

## How the wait is predicted

The relay stores each completed run per project and predicts the next one as the rolling median of the last 10 durations, clamped to 30s..15min, defaulting to 90s for a new project. The phone shows elapsed vs predicted; the bar turns amber past 100% instead of pretending.

## Demo script

1. Show the relay terminal with the QR; pair the phone.
2. In Cursor, send a real prompt. The phone buzzes and shows the challenge within ~1.5s.
3. While the agent works: progress bar creeps, "Refactoring the auth middleware and adding tests" note appears from Grok, file count ticks.
4. Agent finishes: haptic, "Agent done in 87s", one-line summary, quiz answer revealed / game frozen with score. Tap **Back to the diff**.
5. Send a second prompt: the prediction is now based on the first run.

## Notes and limits

- Remote push (banner while the app is closed) uses Expo's push service and needs a real device. In Expo Go on Android remote push is unsupported since SDK 53; the app still gets everything over the WebSocket and fires local notifications when backgrounded.
- Only one run is tracked at a time; a follow-up prompt during a run extends the same wait.
- Grok is optional. Without `XAI_API_KEY` the relay uses canned exercises, quizzes and summaries.
- Deploy the relay anywhere (Fly.io, Railway) and set `PUBLIC_URL` so the QR points at the public address.

## Development

```bash
cd server && npm test && npm run typecheck
cd mobile && npx tsc --noEmit && npx expo-doctor
```
