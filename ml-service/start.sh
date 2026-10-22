#!/bin/bash
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"
nohup python3 app.py > /tmp/ml-service.log 2>&1 < /dev/null &
disown
sleep 8
curl -s http://localhost:8000/health
echo ""
