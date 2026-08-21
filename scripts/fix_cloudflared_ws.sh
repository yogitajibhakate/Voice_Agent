#!/usr/bin/env bash
set -e

CONFIG_FILE="/etc/cloudflared/config.yml"

if [ ! -f "$CONFIG_FILE" ]; then
  echo "Cloudflare config file not found at $CONFIG_FILE"
  exit 1
fi

echo "Updating $CONFIG_FILE to include WebSocket proxying to localhost:8000..."

cat << 'EOF' > "$CONFIG_FILE"
tunnel: 843184e8-1609-42f7-a0b5-f09622f52220
credentials-file: /etc/cloudflared/843184e8-1609-42f7-a0b5-f09622f52220.json

ingress:
  - hostname: voice.automationlabs.online
    path: ^/api/v1/ws
    service: http://localhost:8000
  - hostname: voice.automationlabs.online
    service: http://localhost:3000
  - service: http_status:444
EOF

echo "Restarting cloudflared service..."
systemctl restart cloudflared
echo "Cloudflare Tunnel successfully updated and restarted! WebSockets are now routed directly to FastAPI."
