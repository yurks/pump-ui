# Pump UI

Real-time interface for monitoring and controlling a water pump.

Streams device telemetry over WebSocket, visualizes metrics, and allows safe remote control updates with validation, timeouts, and connection state handling.

## Features

- Real-time metrics (pressure, voltage, current, temperature)
- Remote control of pump settings (mode, limits, enable/disable)
- WebSocket client with:
  - auto-reconnect + backoff
  - heartbeat (ping/pong)
  - message queueing
- Runtime validation of incoming data
- Stale data detection
- Update lifecycle with timeout + error handling
- Mock device server for local development

## Tech Stack

- SvelteKit + Svelte 5
- TypeScript
- Tailwind + Flowbite
- WebSocket-based transport

## Getting Started

Install dependencies:

```bash
npm install
```

Run dev server:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

## Architecture

- `device-client` — stateful WebSocket client handling connection, updates, and errors
- `socket/connector` — reusable transport layer with reconnection + heartbeat
- `validations` — runtime message validation (because networks lie)
- `device-server.dev-mock` — simulated device for development

## Development Notes

- Prevents concurrent updates to avoid race conditions
- Validates all incoming messages before applying state
- Marks data as stale based on last message timestamp
- Mock server simulates telemetry and limit-based warnings

## License

WTFPL
