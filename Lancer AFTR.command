#!/bin/zsh
# Double-clique sur ce fichier pour lancer AFTR, puis ouvre http://localhost:3000
cd "$(dirname "$0")"
export PATH="$HOME/.local/node/bin:$PATH"
if ! command -v node >/dev/null; then
  echo "Node.js est introuvable. Il doit être installé dans ~/.local/node (voir README.md)."
  read -k1
  exit 1
fi
(sleep 2 && open "http://localhost:3000") &
node --no-warnings server/index.js
