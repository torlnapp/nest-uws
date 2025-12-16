# WebSocket test client (one-shot)

Minimal script to hit the example Nest + uWebSockets.js server. It connects, sends a `ping` and a `broadcast`, logs replies, then closes.

## Run
1) Install workspace deps from repo root:
   ```
   bun install
   ```
2) Start the server example in another terminal:
   ```
   bun run --filter nest-uws-adapter-example-server dev
   ```
3) Run the client:
   ```
   bun run --filter nest-uws-adapter-example-client dev
   ```
   (Override endpoint with `WS_URL=ws://localhost:3001/ws`.)
