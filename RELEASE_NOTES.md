# Release Notes - v1.1.0

## New Features
- **Web GUI**: Added a web-based interface for controlling the scanner and viewing results in real-time.
  - Accessible via `http://localhost:3000` (default).
  - Supports starting/stopping scans.
  - Real-time logs and result list.
- **Refactoring**: Logic extracted to `src/scanManager.js` for better maintainability and reusability.

## Improvements
- **Cleanup**: Removed duplicate files from the root directory.
- **Dependencies**: Updated project structure and dependencies.

## Usage
- **Web Mode**: Run `npm start` and open `http://localhost:3000`.
- **CLI Mode**: Run `npm run cli` to use the command-line interface.
