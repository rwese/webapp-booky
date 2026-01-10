#!/usr/bin/env python3
"""
Tickteer - A CLI tool to fetch and display tickets from Beads (bd) sorted by priority.

This tool uses the `bd` command to look for ready tickets and displays them
sorted by priority in descending order (highest priority first).

Daemon mode: Continuously picks the most important ticket and executes shell commands
with parameterized templates.
"""

import argparse
import subprocess
import sys
import json
import time
import re
from typing import List, Dict, Any, Optional
from pathlib import Path


# Default template for ticket details when using stdin
DEFAULT_TEMPLATE = """=== TICKET DETAILS ===
ID: {{id}}
Title: {{title}}
Description: {{description}}
Priority: {{priority_label}} ({{priority}})
Type: {{type_label}}
Status: {{status}}
Created by: {{created_by}}
Created at: {{created_at}}
Updated at: {{updated_at}}
=== END TICKET ===
"""


class Ticket:
    """Represents a Beads ticket."""

    def __init__(self, data: Dict[str, Any]):
        self.id = str(data.get("id", ""))
        self.title = str(data.get("title", ""))
        self.description = str(data.get("description", ""))
        self.status = str(data.get("status", ""))
        self.priority = data.get("priority", 0)
        self.issue_type = str(data.get("issue_type", ""))
        self.created_at = str(data.get("created_at", ""))
        self.created_by = str(data.get("created_by", ""))
        self.updated_at = str(data.get("updated_at", ""))

    def get_template_data(self) -> Dict[str, str]:
        """Get dictionary of all fields for template substitution."""
        # Ensure all values are strings
        return {
            "id": str(self.id) if self.id else "",
            "title": str(self.title) if self.title else "",
            "description": str(self.description) if self.description else "",
            "status": str(self.status) if self.status else "",
            "priority": str(self.priority),
            "priority_label": self._get_priority_label(),
            "issue_type": str(self.issue_type) if self.issue_type else "",
            "type_label": self._get_type_label(),
            "created_by": str(self.created_by) if self.created_by else "",
            "created_at": str(self.created_at) if self.created_at else "",
            "updated_at": str(self.updated_at) if self.updated_at else "",
        }

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
        # Safely handle None issue_type
        issue_type_str = str(self.issue_type) if self.issue_type is not None else ""
        result = type_labels.get(issue_type_str, issue_type_str.upper())
        return result if result else "UNKNOWN"


class TemplateEngine:
    """Handles template rendering with placeholders."""

    PLACEHOLDER_PATTERN = re.compile(r"\{\{(\w+)\}\}")

    @staticmethod
    def render(template: str, data: Dict[str, str]) -> str:
        """Render a template by replacing placeholders with values.

        Args:
            template: Template string with {{placeholder}} syntax
            data: Dictionary mapping placeholder names to values

        Returns:
            Rendered string with all placeholders replaced
        """

        def replace_placeholder(match):
            key = match.group(1)
            return data.get(key, f"{{{{{key}}}}}")

        return TemplateEngine.PLACEHOLDER_PATTERN.sub(replace_placeholder, template)

    @staticmethod
    def render_ticket_details(ticket: Ticket) -> str:
        """Render ticket details using the default template."""
        template_data = ticket.get_template_data()
        return TemplateEngine.render(DEFAULT_TEMPLATE, template_data)


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

    def get_most_important_ticket(self) -> Optional[Ticket]:
        """Get the single most important ready ticket."""
        tickets = self.get_ready_tickets()
        if not tickets:
            return None

        sorted_tickets = self.sort_tickets_by_priority(tickets)
        return sorted_tickets[0]

    def execute_command(
        self,
        command: str,
        args: str,
        ticket: Ticket,
        template: str,
        use_stdin: bool = True,
    ) -> bool:
        """Execute a shell command with ticket details.

        Args:
            command: The command to execute
            args: Arguments to pass to the command
            ticket: The ticket to process
            template: Template string for stdin content
            use_stdin: Whether to pass template rendered content to stdin

        Returns:
            True if command executed successfully, False otherwise
        """
        try:
            # Render the template with ticket data
            template_data = ticket.get_template_data()
            stdin_content = TemplateEngine.render(template, template_data)

            # Build the full command
            full_command = command
            if args:
                full_command += " " + args

            print(f"🚀 Executing: {full_command}")
            print(f"📝 Ticket: {ticket.id} - {ticket.title}")

            # Prepare subprocess execution
            stdin_data = None
            if use_stdin:
                stdin_data = stdin_content

            # Execute the command
            result = subprocess.run(
                full_command,
                shell=True,
                input=stdin_data,
                text=True,
                capture_output=True,
                timeout=300,  # 5 minute timeout
            )

            # Print output
            if result.stdout:
                print("STDOUT:")
                print(result.stdout)

            if result.stderr:
                print("STDERR:")
                print(result.stderr, file=sys.stderr)

            print(f"✅ Command finished with exit code: {result.returncode}")
            return result.returncode == 0

        except subprocess.TimeoutExpired:
            print("❌ Command timed out (5 minute limit)", file=sys.stderr)
            return False
        except Exception as e:
            print(f"❌ Error executing command: {e}", file=sys.stderr)
            return False

    def run_daemon(
        self,
        command: str,
        args: str,
        template: str,
        template_file: Optional[str],
        interval: int,
    ) -> None:
        """Run the daemon mode that continuously processes tickets.

        Args:
            command: Command to execute for each ticket
            args: Arguments for the command
            template: Template string for stdin content
            template_file: Path to file containing template
            interval: Seconds to wait between processing tickets
        """
        # Load template from file if specified
        if template_file:
            template_path = Path(template_file)
            if template_path.exists():
                template = template_path.read_text()
                print(f"📄 Loaded template from: {template_file}")
            else:
                print(f"⚠️  Template file not found: {template_file}, using default")

        print("🎯 Starting Tickteer Daemon")
        print(f"   Command: {command} {args}")
        print(f"   Interval: {interval} seconds")
        print("   Press Ctrl+C to stop")
        print("-" * 50)

        processed_count = 0
        last_ticket_id = None

        try:
            while True:
                # Get the most important ticket
                ticket = self.get_most_important_ticket()

                if not ticket:
                    print("😴 No ready tickets found. Waiting...")
                    time.sleep(interval)
                    continue

                # Skip if we've already processed this ticket
                if ticket.id == last_ticket_id:
                    print("⏳ Same ticket still ready. Waiting...")
                    time.sleep(interval)
                    continue

                print(f"\n🎫 Processing ticket: {ticket.id}")
                print(f"   Title: {ticket.title}")
                print(
                    f"   Priority: {ticket.priority} ({ticket._get_priority_label()})"
                )

                # Execute the command
                success = self.execute_command(
                    command, args, ticket, template, use_stdin=True
                )

                if success:
                    processed_count += 1
                    last_ticket_id = ticket.id
                    print(f"✅ Ticket {ticket.id} processed successfully!")
                else:
                    print(f"⚠️  Failed to process ticket {ticket.id}")

                print(f"\n⏱️  Waiting {interval} seconds before next check...")
                print("-" * 50)
                time.sleep(interval)

        except KeyboardInterrupt:
            print(f"\n\n🛑 Daemon stopped by user")
            print(f"📊 Total tickets processed: {processed_count}")

    def run(self, args: argparse.Namespace) -> None:
        """Main execution method with support for daemon mode.

        Args:
            args: Parsed command-line arguments
        """
        if args.daemon:
            # Run in daemon mode
            template = args.use_stdin_template or DEFAULT_TEMPLATE
            self.run_daemon(
                command=args.run,
                args=args.args or "",
                template=template,
                template_file=args.use_stdin_template_file,
                interval=args.interval or 30,
            )
        else:
            # Normal mode: just display tickets
            tickets = self.get_ready_tickets()
            sorted_tickets = self.sort_tickets_by_priority(tickets)
            self.display_tickets(sorted_tickets)


def parse_arguments() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Tickteer - Fetch and process Beads tickets",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Display ready tickets sorted by priority
  tickteer
  
  # Run in daemon mode, executing a command for each ticket
  tickteer --daemon --run ./process-ticket.sh --args="--priority high"
  
  # Use custom template from file
  tickteer --daemon --run my-tool --use-stdin-template-file template.txt

Available placeholders for templates:
  {{id}}           - Ticket ID
  {{title}}        - Ticket title
  {{description}}  - Ticket description
  {{status}}       - Ticket status
  {{priority}}     - Priority number (0-4)
  {{priority_label}} - Human-readable priority (CRITICAL, HIGH, etc.)
  {{issue_type}}   - Issue type (bug, feature, task)
  {{type_label}}   - Human-readable type (🐛 Bug, ✨ Feature, 📝 Task)
  {{created_by}}   - Creator username
  {{created_at}}   - Creation timestamp
  {{updated_at}}   - Last update timestamp
        """,
    )

    # Daemon mode arguments
    parser.add_argument(
        "--daemon",
        action="store_true",
        help="Run in daemon mode (continuously process tickets)",
    )

    parser.add_argument(
        "--run",
        type=str,
        help="Command to execute for each ticket (required for daemon mode)",
    )

    parser.add_argument(
        "--args", type=str, default="", help="Arguments to pass to the command"
    )

    parser.add_argument(
        "--use-stdin-template",
        type=str,
        help="Template string to pass to command via stdin. Use {{placeholder}} syntax.",
    )

    parser.add_argument(
        "--use-stdin-template-file",
        type=str,
        help="Path to a file containing the template for stdin",
    )

    parser.add_argument(
        "--interval",
        type=int,
        default=30,
        help="Seconds to wait between checks in daemon mode (default: 30)",
    )

    return parser.parse_args()


def main():
    """Entry point for the tickteer CLI tool."""
    args = parse_arguments()

    # Validate daemon arguments
    if args.daemon and not args.run:
        print("❌ Error: --run is required when using --daemon", file=sys.stderr)
        sys.exit(1)

    tickteer = Tickteer()
    tickteer.run(args)


if __name__ == "__main__":
    main()
