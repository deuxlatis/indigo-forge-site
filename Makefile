# ==============================================================================
# Indigo Forge Makefile
# ==============================================================================

.PHONY: help dev build check test clean

# Default target
help:
	@echo "Indigo Forge — Available Commands:"
	@echo "  make dev      Start local development server with no-cache headers"
	@echo "  make build    Bundle 4D explorer into single-file dist/artifact.html"
	@echo "  make check    Validate JSON files and JavaScript syntax"
	@echo "  make clean    Remove generated build artifacts (dist/)"
	@echo ""

# Start local development server
dev:
	@python3 scripts/dev.py

# Build single-file distribution artifact
build:
	@python3 build/build.py

# Run syntax and file integrity checks
check:
	@echo "Checking JSON files..."
	@python3 -m json.tool data/manifest.json > /dev/null && echo "  ✓ data/manifest.json is valid"
	@python3 -m json.tool data/sample-run.json > /dev/null && echo "  ✓ data/sample-run.json is valid"
	@echo "Checking JavaScript syntax..."
	@node -c assets/optres.js && echo "  ✓ assets/optres.js syntax OK"
	@node -c assets/store.js && echo "  ✓ assets/store.js syntax OK"
	@node -c assets/app.js && echo "  ✓ assets/app.js syntax OK"
	@node -c assets/hero.js && echo "  ✓ assets/hero.js syntax OK"
	@node -c assets/theme.js && echo "  ✓ assets/theme.js syntax OK"
	@node -c assets/investors.js && echo "  ✓ assets/investors.js syntax OK"
	@echo "All checks passed!"

test: check

# Clean generated build artifacts
clean:
	@rm -rf dist/
	@echo "Cleaned dist/ directory."
