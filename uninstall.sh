#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)

case "${SHELL:-}" in
  */zsh) PROFILE="$HOME/.zshrc" ;;
  */bash) PROFILE="$HOME/.bashrc" ;;
  *) PROFILE="$HOME/.profile" ;;
esac

PROFILE_CHANGED=0
if [ -f "$PROFILE" ]; then
  TEMP_PROFILE=$(mktemp "${TMPDIR:-/tmp}/cli-toolkit-fw-profile.XXXXXX")
  trap 'rm -f "$TEMP_PROFILE"' EXIT INT TERM
  IN_BLOCK=0
  while IFS= read -r LINE || [ -n "$LINE" ]; do
    if [ "$LINE" = '# cli-toolkit-fw' ]; then
      IN_BLOCK=1
      PROFILE_CHANGED=1
      continue
    fi
    if [ "$LINE" = '# end cli-toolkit-fw' ] && [ "$IN_BLOCK" -eq 1 ]; then
      IN_BLOCK=0
      continue
    fi
    if [ "$IN_BLOCK" -eq 0 ]; then printf '%s\n' "$LINE" >> "$TEMP_PROFILE"; fi
  done < "$PROFILE"
  if [ "$PROFILE_CHANGED" -eq 1 ]; then
    mv "$TEMP_PROFILE" "$PROFILE"
  else
    rm -f "$TEMP_PROFILE"
  fi
  trap - EXIT INT TERM
fi

GENERATED_DIR="$SCRIPT_DIR/.cli-toolkit-fw"
DEPENDENCIES_DIR="$SCRIPT_DIR/node_modules"
GENERATED_REMOVED=0
case "$GENERATED_DIR" in
  "$SCRIPT_DIR/.cli-toolkit-fw")
    if [ -d "$GENERATED_DIR" ]; then
      rm -rf -- "$GENERATED_DIR"
      GENERATED_REMOVED=1
    fi
    ;;
  *)
    echo 'Refusing to remove an unexpected generated directory.' >&2
    exit 1
    ;;
esac

DEPENDENCIES_REMOVED=0
case "$DEPENDENCIES_DIR" in
  "$SCRIPT_DIR/node_modules")
    if [ -d "$DEPENDENCIES_DIR" ]; then
      rm -rf -- "$DEPENDENCIES_DIR"
      DEPENDENCIES_REMOVED=1
    fi
    ;;
  *)
    echo 'Refusing to remove an unexpected dependency directory.' >&2
    exit 1
    ;;
esac

printf 'cli-toolkit-fw environment registration was removed.\n'
printf 'Shell environment block removed: %s\n' "$PROFILE_CHANGED"
printf 'Generated launcher directory removed: %s\n' "$GENERATED_REMOVED"
printf 'Dependency directory removed: %s\n' "$DEPENDENCIES_REMOVED"
printf 'Bun, source code, extensions, configuration, and logs were kept.\n'
printf 'Open a new terminal for the environment changes to take effect.\n'

if [ -t 0 ]; then
  printf '\nPress any key to exit...'
  PREVIOUS_STTY=$(stty -g)
  trap 'stty "$PREVIOUS_STTY"' EXIT INT TERM
  stty -echo -icanon min 1 time 0
  dd bs=1 count=1 >/dev/null 2>&1
  stty "$PREVIOUS_STTY"
  trap - EXIT INT TERM
  printf '\n'
fi
