#!/usr/bin/env bash
# Generate Prisma Client without downloading native engine binaries.
# The `prisma-client` generator with engineType="client" uses the bundled WASM
# query compiler; the CLI still probes for engine files, so we point it at
# harmless placeholders. Real binaries are unnecessary for generate/validate.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLACEHOLDER_DIR="$ROOT/.prisma-offline"
mkdir -p "$PLACEHOLDER_DIR"
printf 'prisma-offline-engine-placeholder\n' > "$PLACEHOLDER_DIR/libquery_engine.so.node"
printf '#!/bin/sh\nexit 0\n' > "$PLACEHOLDER_DIR/schema-engine"
chmod +x "$PLACEHOLDER_DIR/schema-engine"
export PRISMA_QUERY_ENGINE_LIBRARY="$PLACEHOLDER_DIR/libquery_engine.so.node"
export PRISMA_SCHEMA_ENGINE_BINARY="$PLACEHOLDER_DIR/schema-engine"
export PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
cd "$ROOT"
npx prisma generate "$@"
