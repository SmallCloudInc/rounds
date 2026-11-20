#!/bin/zsh
# Prints one line per new comment in ~/.rounds/inbox, then keeps watching.
# The relay session runs this under Monitor and delivers each one.
setopt null_glob
INBOX="$HOME/.rounds/inbox"
mkdir -p "$INBOX"
typeset -A seen
while true; do
  for f in "$INBOX"/*.json; do
    [[ -n "${seen[$f]}" ]] && continue
    seen[$f]=1
    echo "comment $f"
  done
  sleep 1
done
