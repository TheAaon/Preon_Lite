#!/bin/bash
cd "$(dirname "$0")"
if [ ! -d node_modules ]; then
  npm install || exit 1
fi
( sleep 1; open http://localhost:1420 2>/dev/null || true ) &
npm run dev
