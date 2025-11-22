# Minecraft Server Scanner

A powerful Node.js tool to scan IPv4 ranges for Minecraft servers, gathering detailed information using a real Mineflayer bot instance.

## Features

- **Efficient Scanning**: Uses a lightweight port scanner to filter offline IPs before connecting the bot.
- **Concurrency**: Scans multiple IPs in parallel while limiting heavy bot instances to prevent memory issues.
- **Deep Analysis**:
  - **Player Info**: Counts online players and samples names.
  - **Gamemode & Version**: Detects the server game mode and Minecraft version.
  - **Structure Detection**: Scans the environment for "artificial" blocks (planks, bricks, glass, etc.) to identify built structures.
  - **Permission Testing**: Attempts to break blocks to check if building/destroying is enabled.
  - **Spawn Protection Evasion**: If block breaking fails initially, the bot runs away from spawn and tries again.
- **Output**: Saves results incrementally to `servers.jsonl` (Newline Delimited JSON).

## Prerequisites

- [Node.js](https://nodejs.org/) (Version 16 or higher recommended)

## Installation

### Windows
1. Double-click `installer.bat`.
   - This will run `npm install` to download necessary dependencies.
2. Once finished, you can start the scanner.

### Manual / Linux / macOS
1. Open a terminal in the project folder.
2. Run:
   ```bash
   npm install
   ```

## Usage

To start the scanner, run:

```bash
node index.js
```

Follow the on-screen prompts:
1. **Start IP**: The starting IPv4 address (e.g., `1.2.3.4`).
2. **End IP**: The ending IPv4 address (e.g., `1.2.3.255`).
3. **Microsoft Account**: You can choose to use a Microsoft account or scan in "Offline" mode (for cracked servers or just checking MOTD/public info).
   - *Note: To fully test block breaking on online-mode servers, a valid account is required.*

## Output

Results are saved to `servers.jsonl`. Each line is a valid JSON object representing a found server.

Example entry:
```json
{
  "ip": "1.2.3.4",
  "port": 25565,
  "online": true,
  "version": "1.20.1",
  "players": { "max": 0, "online": 5, "sample": [...] },
  "gamemode": "survival",
  "structures": ["oak_planks", "cobblestone"],
  "canBreakBlocks": false,
  "spawnProtection": true
}
```

## Disclaimer

Scanning networks you do not own may violate terms of service of your ISP or the target networks. Use this tool responsibly and only on networks you have permission to scan.
