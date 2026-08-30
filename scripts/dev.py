#!/usr/bin/env python3
"""Local development server for Indigo Forge.

Serves the site with no-cache headers and helpful link diagnostics.
Usage:
    python3 scripts/dev.py [--port 8000] [--no-browser]
"""
import argparse
import http.server
import os
import pathlib
import socket
import socketserver
import sys
import webbrowser

ROOT = pathlib.Path(__file__).resolve().parent.parent


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        # Prevent browser caching during local development
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, format, *args):
        # Format log messages with clean status output
        sys.stderr.write(f"[{self.log_date_time_string()}] {self.address_string()} - {format % args}\n")


def is_port_available(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("127.0.0.1", port)) != 0


def find_available_port(start_port=8000, max_attempts=20):
    for p in range(start_port, start_port + max_attempts):
        if is_port_available(p):
            return p
    return start_port


def main():
    parser = argparse.ArgumentParser(description="Indigo Forge Local Dev Server")
    parser.add_argument("--port", "-p", type=int, default=8000, help="Port to serve on (default: 8000)")
    parser.add_argument("--no-browser", action="store_true", help="Do not open browser automatically")
    args = parser.parse_args()

    port = args.port
    if not is_port_available(port):
        new_port = find_available_port(port + 1)
        print(f"[!] Port {port} is busy. Using port {new_port} instead.")
        port = new_port

    socketserver.TCPServer.allow_reuse_address = True

    try:
        with socketserver.TCPServer(("127.0.0.1", port), NoCacheHandler) as httpd:
            base_url = f"http://localhost:{port}"
            print("=" * 66)
            print("  ⚡ INDIGO FORGE — Local Development Server")
            print("=" * 66)
            print(f"  • Landing Page:      {base_url}/")
            print(f"  • 4D Risk Explorer:  {base_url}/explorer/")
            print(f"  • Investor Portal:   {base_url}/investors/")
            print(f"  • Bundled Artifact:  {base_url}/dist/artifact.html")
            print("-" * 66)
            print(f"  Serving directory:   {ROOT}")
            print("  No-cache mode:       ENABLED (CSS/JS reload instantly)")
            print("  Press Ctrl+C to stop.")
            print("=" * 66)

            if not args.no_browser:
                try:
                    webbrowser.open(base_url)
                except Exception:
                    pass

            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[*] Server stopped.")
        sys.exit(0)
    except Exception as e:
        print(f"\n[!] Error starting server: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
