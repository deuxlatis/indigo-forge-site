#!/usr/bin/env python3
"""Bundle the site into one self-contained HTML file.

The site itself (the content pages + assets/ + data/) is what GitHub Pages
serves. This script folds the 4D explorer's sources into dist/artifact.html, a
single file with no external references except the fonts and the Plotly CDN —
handy for emailing, for opening straight off disk, or for publishing as a
Claude artifact.

Usage:  python3 build/build.py
"""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"

# The single file lives away from the site, so body links can't stay relative
# and the tab keeps the name the published artifact already goes by.
SITE = "https://indigo.gzarruk.com/"
ARTIFACT_TITLE = "Indigo Forge Risk Surface"


def read(*parts):
    return (ROOT.joinpath(*parts)).read_text(encoding="utf-8")


def main():
    # The research page — it is the page with the Plotly stage and the loader
    # this bundle is built around.
    html = read("research", "index.html")

    # non-greedy, so the capture stops at the first external <script src> and
    # the page's relative asset script tags stay out of the bundle
    body = re.search(r"<body>\n(.*?)\n<script src", html, re.S).group(1)
    body = body.replace('href="../index.html"', f'href="{SITE}"')
    body = body.replace('href="./"', f'href="{SITE}research/"')
    body = body.replace('href="../', f'href="{SITE}')
    fonts = re.search(r'(<link rel="preconnect".*?display=swap">)', html, re.S).group(1)
    loader = re.search(r"(<script>\n\(function \(\) \{\n  var srcs.*?</script>)", html, re.S).group(1)

    manifest = json.loads(read("data", "manifest.json"))
    bundled = [json.loads(read("data", entry["file"])) for entry in manifest]

    parts = [
        '<meta charset="utf-8">',
        f"<title>{ARTIFACT_TITLE}</title>",
        fonts,
        "<style>",
        read("assets", "app.css"),
        read("assets", "chrome.css"),
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
