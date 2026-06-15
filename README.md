# pharo-agentic-browser-web-ui

Client-side Web UI for [pharo-agentic-browser](../pharo-agentic-browser).

## Overview

- **Role**: Client-side module for the Web UI of `pharo-agentic-browser`
- **Purpose**: Exposes the basic features of `pharo-agentic-browser` to a web browser
- **Target Environment**: Single-user, local area network (LAN) usage. No authentication required.
- **Out of Scope**: UI features designed for Pharo-local environment source editing (e.g., package export confirmation, setting target packages, working directory configuration, etc.)
- **Server Implementation**: Located at `../pharo-agentic-browser` (Web-UI module)

## Dependencies

- **ripple-st-client** (`../ripple-st-client`): WebSocket (Ripple protocol) communication
- **Solid.js**: Reactive UI framework (SPA foundation)
- **daisyUI** + **Tailwind CSS**: UI styling and responsive design

## Setup

```bash
npm install
```

## Available Scripts

### `npm run dev`

Runs the app in development mode. Open [http://localhost:5173](http://localhost:5173) in the browser.

### `npm run build`

Builds for production into `/assets/agentic-browser`.  
Assets are served at `http://localhost:8080/assets/agentic-browser` via Teapot.

### `npm test`

Runs the test suite with Vitest.

## Development Guidelines

- **Server-Side Issues**: If there are bugs or gaps in server behavior/protocol, do not implement workarounds on the client. Document them as server-side issues instead.
- **Development Process**: Proceed incrementally using TDD.
- **Mock Server**: Ensure a mock environment is available before full integration testing with Pharo + Ripple.

## Specifications

- Protocol Reference: [web-ui-api.md](https://github.com/mumez/pharo-agentic-browser/blob/main/docs/web-ui-api.md)

## License

MIT
