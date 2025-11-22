# Minecraft Server Scanner

This project scans IPv4 ranges for Minecraft servers, connects to them using a bot, and gathers information about the server configuration, players, and environment.

## Structure

- `index.js`: Main entry point. Handles user input and the scanning loop.
- `src/ipUtils.js`: Utilities for IP address conversion and iteration.
- `src/scanner.js`: Lightweight port scanner to check for open ports (25565).
- `src/bot.js`: Mineflayer bot logic for deep analysis (auth, structure detection, block breaking).
- `servers.json`: Output file containing scanned server data.

## Instructions

- **Concurrency**: The scanner uses `p-limit` to manage concurrency.
- **Bot Behavior**: The bot attempts to join, looks for artificial blocks, and tests block breaking permissions.
- **Data**: Results are appended to `servers.json`.

## Developer Notes

- Do not modify `node_modules`.
- Ensure error handling is robust, as connecting to random IPs can cause various network timeouts and errors.
