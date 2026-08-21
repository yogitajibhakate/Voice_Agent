#!/usr/bin/env bash
set -e

# Export PATH so Node (NVM) and Python Venv are accessible in non-interactive / systemd environments
export PATH="/home/ng/.nvm/versions/node/v20.19.6/bin:/home/ng/dograh/venv/bin:$PATH"

BASE_DIR="$(cd "$(dirname "$(dirname "${BASH_SOURCE[0]}")")" && pwd)"
cd "$BASE_DIR"

echo "=== Starting Dograh Full Development Stack ==="

# 1. Start Docker services (Postgres, Redis, MinIO)
echo "→ Starting Docker services..."
docker compose -f docker-compose-local.yaml up -d

# 2. Start Backend services
echo "→ Starting Backend services..."
bash scripts/start_services_dev.sh

# 3. Start Frontend UI & Proxy (Port 3000)
echo "→ Starting Frontend UI & Proxy on Port 3000..."
cd "$BASE_DIR/ui"
export SKIP_BACKEND=true
exec node scripts/dev.js
