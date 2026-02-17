#!/bin/bash
set -e

echo "=== Super Bowl Deployment Script ==="
echo "Timestamp: $(date)"
echo "User: $(whoami)"
echo ""

# Wechsle ins Projekt-Verzeichnis
cd /opt/super-bowl

# Git Status vorher
echo "--- Git Status (before) ---"
git status --short
echo ""

# Hole neuesten Code von GitHub
echo "--- Pulling latest code from GitHub ---"
git fetch origin
git reset --hard origin/main
echo "Latest commit: $(git log -1 --oneline)"
echo ""

# Docker Compose Build & Restart
echo "--- Building and restarting Docker container ---"
docker compose down
docker compose up -d --build

# Warte kurz auf Container-Start
echo ""
echo "--- Waiting for container to start ---"
sleep 5

# Container Status
echo ""
echo "--- Container Status ---"
docker compose ps

# Health Check
echo ""
echo "--- Health Check ---"
if curl -f http://127.0.0.1:8082/ > /dev/null 2>&1; then
    echo "✅ App is responding on port 8082"
else
    echo "❌ App is NOT responding on port 8082"
    echo "Container logs:"
    docker compose logs --tail=50
    exit 1
fi

echo ""
echo "=== Deployment completed successfully ==="
