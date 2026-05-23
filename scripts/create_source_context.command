#!/usr/bin/env zsh
cd "$(dirname "$0")/.."
clear
echo "Assembling project source context..."
node scripts/create_source_context.js
