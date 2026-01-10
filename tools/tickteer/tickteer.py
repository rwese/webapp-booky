#!/usr/bin/env python3
"""
Tickteer - A CLI tool to fetch and display tickets from Beads (bd) sorted by priority.

This tool uses the `bd` command to look for ready tickets and displays them
sorted by priority in descending order (highest priority first).
"""

import subprocess
import sys
import json
from typing import List, Dict, Any
from pathlib import Path


class Ticket:
    """Represents a Beads ticket."""

    def __init__(self, data: Dict[str, Any]):
        self.id = data.get("id", "")
        self.title = data.get("title", "")
        self.description = data.get("description", "")
        self.status = data.get("status", "")
        self.priority = data.get("priority", 0)
        self.issue_type = data.get("issue_type", "")
        self.created_at = data.get("created_at", "")
        self.created_by = data.get("created_by", "")
        self.updated_at = data.get("updated_at", "")

    def __str__(self) -> str:
        """String representation of the ticket."""
        priority_label = self._get_priority_label()
        type_label = self._get_type_label()

        lines = [
            f"📋 {self.id}",
            f"   Title: {self.title}",
            f"   Priority: {priority_label} ({self.priority})",
            f"   Type: {type_label}",
            f"   Status: {self.status}",
        ]

        if self.created_by:
            lines.append(f"   Created by: {self.created_by}")

        return "\n".join(lines)

    def _get_priority_label(self) -> str:
        """Get human-readable priority label."""
        priority_labels = {
            0: "🔴 CRITICAL",
            1: "🟠 HIGH",
            2: "🟡 MEDIUM",
            3: "🟢 LOW",
            4: "⚪ BACKLOG",
        }
        return priority_labels.get(self.priority, f"Unknown ({self.priority})")

    def _get_type_label(self) -> str:
        """Get human-readable type label."""
        type_labels = {"bug": "🐛 Bug", "feature": "✨ Feature", "task": "📝 Task"}
        issue_type = self.issue_type or ""
        return type_labels.get(self.issue_type, issue_type.upper())


class Tickteer:
    """Main class for the Tickteer tool."""

    def __init__(self):
        self.bd_command = "bd"

    def get_ready_tickets(self) -> List[Ticket]:
        """Fetch ready tickets using the bd command."""
        try:
            result = subprocess.run(
                [self.bd_command, "ready", "--json"],
                capture_output=True,
                text=True,
                check=True,
            )

            tickets_data = json.loads(result.stdout)
            return [Ticket(data) for data in tickets_data]

        except subprocess.CalledProcessError as e:
            print(f"Error running bd command: {e}", file=sys.stderr)
            print(f"stdout: {e.stdout}", file=sys.stderr)
            print(f"stderr: {e.stderr}", file=sys.stderr)
            sys.exit(1)
        except json.JSONDecodeError as e:
            print(f"Error parsing bd JSON output: {e}", file=sys.stderr)
            sys.exit(1)
        except FileNotFoundError:
            print(
                "Error: 'bd' command not found. Please ensure Beads is installed.",
                file=sys.stderr,
            )
            sys.exit(1)

    def sort_tickets_by_priority(self, tickets: List[Ticket]) -> List[Ticket]:
        """Sort tickets by priority in ascending order (highest priority first).

        In Beads, priority 0 is CRITICAL (highest), 1 is HIGH, 2 is MEDIUM, etc.
        So we sort ascending to show CRITICAL tickets first.
        """
        return sorted(tickets, key=lambda t: t.priority)

    def display_tickets(self, tickets: List[Ticket]) -> None:
        """Display tickets in a formatted way."""
        if not tickets:
            print("No ready tickets found! 🎉")
            return

        print(f"Found {len(tickets)} ready ticket(s) sorted by priority:\n")

        for i, ticket in enumerate(tickets, 1):
            print(f"{i}. {ticket}")
            print()

    def run(self) -> None:
        """Main execution method."""
        tickets = self.get_ready_tickets()
        sorted_tickets = self.sort_tickets_by_priority(tickets)
        self.display_tickets(sorted_tickets)


def main():
    """Entry point for the tickteer CLI tool."""
    tickteer = Tickteer()
    tickteer.run()


if __name__ == "__main__":
    main()
