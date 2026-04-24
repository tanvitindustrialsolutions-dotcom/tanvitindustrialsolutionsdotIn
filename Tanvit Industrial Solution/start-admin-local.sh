#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

if ! command -v node &>/dev/null; then
  echo "Install Node.js: https://nodejs.org"
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "First time: npm install..."
  npm install
fi

echo "Starting server in background on http://127.0.0.1:8787"
npm run server &
PID=$!
sleep 5
if command -v xdg-open &>/dev/null; then
  xdg-open "http://127.0.0.1:8787/admin/" || true
elif command -v open &>/dev/null; then
  open "http://127.0.0.1:8787/admin/" || true
fi
echo "Server PID $PID — stop with: kill $PID"
wait $PID
