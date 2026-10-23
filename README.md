# Friday AI demo with a local backend

This is a learning/demo project based on the supplied Friday AI interface. It adds a small Node.js backend and a Boeing 787 information page.

## Start it in VS Code on Windows

1. Extract this folder if you received it as a ZIP.
2. Open the `friday_ai_professional_demo_backend` folder in VS Code.
3. Choose **Terminal → New Terminal**.
4. Run:

   ```powershell
   node server.js
   ```

5. Open [http://127.0.0.1:3000](http://127.0.0.1:3000) in your browser.
6. Keep the terminal open while using the app. Press **Ctrl+C** in that terminal to stop the server.

Node.js 18 or later is recommended. There are no packages to install and no `npm install` step.

## What the backend does

- Serves the interface and its local API.
- Saves the demo flight phase, generated sample values, chart history, demo events, and diagnostic log to `data/demo-state.json`.
- Restores that demo state the next time the server starts.
- Provides Boeing 787 family information through `GET /api/aircraft/787`.
- Provides a basic status endpoint at `GET /api/health`.

The server listens on this computer only (`127.0.0.1`). It has no login or internet connection and is intended for local learning and demonstration.

## Boeing 787 information included

The information page compares Boeing's published 787-8, 787-9, and 787-10 two-class seat ranges, maximum takeoff weights, ranges, and dimensions. It also lists the two engine options and selected design notes. Figures are general family-level specifications; actual airline configurations and operating conditions vary.

Sources:

- [Boeing 787 Dreamliner specifications](https://www.boeing.com/commercial/787)
- [Boeing 787 Dreamliner by design](https://www.boeing.com/commercial/787/by-design)

## Important limitation

This app is a software simulation. Its telemetry and system-health values are generated for the demo and are not actual Boeing 787 data. It does not connect to an aircraft or Boeing systems. Do not use it for flight operations, dispatch, maintenance, or safety decisions.
