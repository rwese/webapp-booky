# Tickteer

A CLI tool to fetch and display tickets from Beads (bd) sorted by priority.

## Installation

### Via uv (recommended)

```bash
uv pip install -e .
```

### Via pip

```bash
pip install -e .
```

## Usage

### Run with uv

```bash
uv run tickteer
```

### Run after installation

```bash
tickteer
```

## Features

- Fetches ready tickets from Beads using the `bd` command
- Automatically sorts tickets by priority in descending order
- Displays detailed ticket information with color-coded priority and type labels
- Shows ticket ID, title, priority, type, status, and creator

## Requirements

- Python 3.8+
- Beads (bd) CLI tool installed and available in PATH

## License

MIT
