# GPU Scheduler Dashboard

A React application built with Create React App and Tailwind CSS that simulates a GPU scheduler for an 8-SM chip.

## Description

This project provides an interactive visualization of a GPU scheduler design. It simulates:
- 8 Streaming Multiprocessors (SMs)
- priority-based job dispatch
- FIFO back-pressure handling
- heartbeat watchdog and fault detection
- live waveform signal tracing
- an AI assistant for design analysis and mentor-ready explanations

The app is intended for learning, demonstration, and system-level debugging of scheduler behavior.

## Use of the project

Use this project to:
- observe how a GPU scheduler dispatches jobs to SMs in real time
- study how priority levels affect job selection
- monitor FIFO fullness and active job count
- inject SME faults and see how the system responds
- visualize timing signals with a waveform viewer
- ask questions about design trade-offs, synthesis results, and fault logic via the built-in AI assistant

## Advantages

- Interactive simulation with `Run`, `Pause`, and `Reset` controls
- Live status overview for all 8 SMs, including busy/idle/fault states
- Waveform monitor showing clock, dispatch, completion, FIFO and heartbeat signals
- Built-in AI chat assistant for technical explanations and presentation tips
- No real hardware required: this is a browser-based scheduler demo
- Easy GitHub-friendly source structure for sharing or coursework

## Project structure

- `public/index.html` — HTML entry point for the app
- `src/App.jsx` — main React component and simulation UI
- `src/index.js` — app bootstrap and React DOM render
- `src/index.css` — global styles
- `tailwind.config.js` — Tailwind CSS configuration
- `package.json` — project dependencies and npm scripts
- `package-lock.json` — exact dependency versions

## Step-by-step usage guide

1. Clone the repository or copy the project files.
2. Open the project folder in a terminal.
3. Install dependencies:

```bash
npm install
```

4. Start the development app:

```bash
npm start
```

5. Open the browser at `http://localhost:3000`.
6. Use the `Run` button to start the scheduler simulation.
7. Pause the simulation with `Pause` and reset with `Reset`.
8. Watch the SM Status Grid to see which SMs are busy, idle, or faulted.
9. Observe FIFO status and job priority values in the dashboard.
10. Use the waveform canvas to inspect signal timing and trends.
11. In the AI Design Assistant panel, use quick action buttons or type your own question.
12. If desired, inject faults into a specific SM to test fault behavior.

## Optional AI setup

If you want the AI assistant to use OpenAI or Anthropic cloud APIs, create a `.env` file with one of these variables:

```bash
REACT_APP_OPENAI_API_KEY=your_openai_api_key
# or
REACT_APP_ANTHROPIC_API_KEY=your_anthropic_api_key
```

Then restart the app after adding the key.

## Available commands

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm start
```

Build the production bundle:

```bash
npm run build
```

Run tests:

```bash
npm test
```

## Notes

- Do not upload `node_modules/` to GitHub.
- The `build/` directory is generated output and is not required in source control unless you want to store a production build.
- This app is served locally at `http://localhost:3000` when running `npm start`.
