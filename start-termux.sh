#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

echo "[1/4] Updating packages"
pkg update -y

echo "[2/4] Installing required packages (node, sqlite)"
pkg install -y nodejs sqlite

echo "[3/4] Installing npm dependencies"
if [ -f package-lock.json ]; then
  npm ci || npm install
else
  npm install
fi

export NODE_OPTIONS="${NODE_OPTIONS:-} --experimental-wasm-threads --experimental-wasm-simd"

echo "[4/4] Starting server on 0.0.0.0:${PORT:-5000}"
export PORT="${PORT:-5000}"
export HOST="${HOST:-0.0.0.0}"
npm run start:termux || node server.js
