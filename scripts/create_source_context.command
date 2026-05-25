#!/usr/bin/env zsh

cd "$(dirname "$0")/.."

printf '\e[8;42;85t'

CYAN='\x1b[36m'
YELLOW='\x1b[33m'
NC='\x1b[0m'

clear
echo ""
echo -e "${YELLOW}  ┌──────────────────────────────────────────────────┐${NC}"
echo -e "${YELLOW}  │${NC}                    ${CYAN}PROJECT SILK                  ${NC}${YELLOW}│${NC}"
echo -e "${YELLOW}  │${NC}             Compiling AI Context...              ${YELLOW}│${NC}"
echo -e "${YELLOW}  └──────────────────────────────────────────────────┘${NC}"
echo ""

node scripts/create_source_context.js
