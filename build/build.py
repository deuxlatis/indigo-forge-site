#!/usr/bin/env python3
"""Bundle the site into one self-contained HTML file.

The site itself (index.html + assets/ + data/) is what GitHub Pages serves.
This script folds the same sources into dist/artifact.html, a single file with
no external references except the fonts and the Plotly CDN — handy for emailing,
for opening straight off disk, or for publishing as a Claude artifact.

Usage:  python3 build/build.py
"""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"


def read(*parts):
    return (ROOT.joinpath(*parts)).read_text(encoding="utf-8")


def main():
    html = read("index.html")
    src_file = ["explorer", "index.html"] if (ROOT / "explorer" / "index.html").exists() else ["index.html"]
    html = read(*src_file)

    body = re.search(r"<body>\n(.*)\n<script src", html, re.S).group(1)
    title = re.search(r"<title>(.*?)</title>", html).group(1)
    fonts = re.search(r'(<link rel="preconnect".*?display=swap">)', html, re.S).group(1)
    loader = re.search(r"(<script>\n\(function \(\) \{\n  var srcs.*?</script>)", html, re.S).group(1)

    manifest = json.loads(read("data", "manifest.json"))
    bundled = [json.loads(read("data", entry["file"])) for entry in manifest]

    parts = [
        f"<title>{title}</title>",
        fonts,
        "<style>",
        read("assets", "app.css"),
        "</style>",
        body,
        "<script>window.__BUNDLED = " + json.dumps(bundled, separators=(",", ":")) + ";</script>",
        "<script>", read("assets", "optres.js"), "</script>",
        "<script>", read("assets", "store.js"), "</script>",
        "<script>", read("assets", "app.js"), "</script>",
        loader,
    ]

    DIST.mkdir(exist_ok=True)
    out = DIST / "artifact.html"
    out.write_text("\n".join(parts), encoding="utf-8")
    print(f"wrote {out.relative_to(ROOT)}  ({out.stat().st_size / 1024:.0f} KB, "
          f"{len(bundled)} bundled report(s))")


if __name__ == "__main__":
    main()
