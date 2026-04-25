# GetTokens Project Context

GetTokens is a cross-platform desktop application built using the [Wails](https://wails.io/) framework. It is designed to manage Proxy API credentials, including auth files and API keys, providing a centralized interface for credential lifecycle management and quota monitoring.

## Project Structure

- `app.go` & `main.go`: Entry points and frontend bindings for the Wails application.
- `internal/`: Core backend logic implemented in Go.
  - `accounts/`: Account domain logic and data structures.
  - `cliproxyapi/`: Interaction layer for external Proxy APIs.
  - `sidecar/`: Management of external sidecar processes.
  - `updater/`: Application self-update mechanism.
  - `wailsapp/`: Core Wails integration and lifecycle management.
- `frontend/`: React-based user interface.
  - `src/`: TypeScript source code.
  - `tailwind.config.js`: Styling configuration.
- `docs-linhay/`: Highly structured documentation system.
  - `spaces/`: Feature-specific workspaces.
  - `dev/`: Technical design and governance documents.
  - `memory/`: Long-term memory and decision logs.
- `AGENTS.md`: Mandatory behavioral guidelines for AI agents working on this repository.

## Building and Running

### Prerequisites
- [Go](https://golang.org/) (1.23+)
- [Node.js](https://nodejs.org/) & [npm](https://www.npmjs.com/)
- [Wails CLI](https://wails.io/docs/gettingstarted/installation)

### Development
To run the application in development mode with hot-reloading for both backend and frontend:
```bash
wails dev
```

### Production Build
To build a production-ready binary:
```bash
wails build
```

### Frontend-specific Tasks
```bash
cd frontend
npm install   # Install dependencies
npm run dev   # Start Vite dev server
npm run build # Build frontend assets
npm run typecheck # Run TypeScript type checking
```

## Development Conventions (Mandatory)

All developers and AI agents must strictly adhere to the guidelines in `AGENTS.md`. Key highlights include:

1.  **BDD + TDD**: Scenario and acceptance criteria first, followed by failing tests, then implementation.
2.  **Communication**: Chinese is the primary language for communication and documentation within this project.
3.  **Documentation First**: Requirement changes must be updated in `docs-linhay/spaces/` before code modification.
4.  **Memory System**: Key decisions and milestones must be recorded in `docs-linhay/memory/`.
5.  **Agent Roles**: Gemini primarily handles Web/Frontend implementation; Codex focuses on business logic, API contracts, and integration.
6.  **Skills Evolution**: Repeated patterns should be distilled into project-level `skills` in `.agents/skills/`.
7.  **DoD (Definition of Done)**: Includes meeting acceptance criteria, passing tests, updating documentation, and recording memory.

Refer to `AGENTS.md` and `docs-linhay/README.md` for exhaustive details on workflows and folder naming conventions.
