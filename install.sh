#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
BOOTSTRAP="$SCRIPT_DIR/cli-toolkit-fw"

if [ ! -f "$BOOTSTRAP" ]; then
  echo "Framework launcher not found: $BOOTSTRAP" >&2
  exit 1
fi

printf 'Command and UI name [toolkit]: '
IFS= read -r CUSTOM_NAME || CUSTOM_NAME=
CUSTOM_NAME=${CUSTOM_NAME:-toolkit}
case "$CUSTOM_NAME" in
  [A-Za-z0-9]*) ;;
  *) echo 'Name must start with a letter or number.' >&2; exit 1 ;;
esac
case "$CUSTOM_NAME" in
  *[!A-Za-z0-9._-]*) echo 'Name may contain only letters, numbers, dot, underscore, or hyphen.' >&2; exit 1 ;;
esac
if [ "${#CUSTOM_NAME}" -gt 40 ]; then
  echo 'Name must not exceed 40 characters.' >&2
  exit 1
fi

if command -v bun >/dev/null 2>&1; then
  BUN_COMMAND=$(command -v bun)
else
  if ! command -v curl >/dev/null 2>&1; then
    echo "curl is required to install Bun." >&2
    exit 1
  fi
  echo "Bun is not installed. Installing Bun..."
  INSTALLER=$(mktemp "${TMPDIR:-/tmp}/cli-toolkit-fw-bun.XXXXXX")
  trap 'rm -f "$INSTALLER"' EXIT INT TERM
  curl -fsSL https://bun.sh/install -o "$INSTALLER"
  sh "$INSTALLER"
  rm -f "$INSTALLER"
  trap - EXIT INT TERM
  BUN_COMMAND="$HOME/.bun/bin/bun"
fi

if [ ! -x "$BUN_COMMAND" ]; then
  echo "Bun was installed but is not executable: $BUN_COMMAND" >&2
  exit 1
fi

echo "Installing dependencies..."
cd "$SCRIPT_DIR"
"$BUN_COMMAND" install --frozen-lockfile
"$BUN_COMMAND" run typecheck
"$BUN_COMMAND" test

chmod +x "$BOOTSTRAP"
LAUNCHER_DIR="$SCRIPT_DIR/.cli-toolkit-fw/launchers/$CUSTOM_NAME"
mkdir -p "$LAUNCHER_DIR"
ln -sfn "$BOOTSTRAP" "$LAUNCHER_DIR/$CUSTOM_NAME"

case "${SHELL:-}" in
  */zsh) PROFILE="$HOME/.zshrc" ;;
  */bash) PROFILE="$HOME/.bashrc" ;;
  *) PROFILE="$HOME/.profile" ;;
esac

if [ -f "$PROFILE" ]; then
  TEMP_PROFILE=$(mktemp "${TMPDIR:-/tmp}/cli-toolkit-fw-profile.XXXXXX")
  trap 'rm -f "$TEMP_PROFILE"' EXIT INT TERM
  IN_BLOCK=0
  while IFS= read -r LINE || [ -n "$LINE" ]; do
    if [ "$LINE" = '# cli-toolkit-fw' ]; then IN_BLOCK=1; continue; fi
    if [ "$LINE" = '# end cli-toolkit-fw' ] && [ "$IN_BLOCK" -eq 1 ]; then IN_BLOCK=0; continue; fi
    if [ "$IN_BLOCK" -eq 0 ]; then printf '%s\n' "$LINE" >> "$TEMP_PROFILE"; fi
  done < "$PROFILE"
  mv "$TEMP_PROFILE" "$PROFILE"
  trap - EXIT INT TERM
fi

{
  printf '\n# cli-toolkit-fw\n'
  printf 'export CLI_TOOLKIT_FW_HOME="%s"\n' "$SCRIPT_DIR"
  printf 'export CLI_TOOLKIT_FW_NAME="%s"\n' "$CUSTOM_NAME"
  printf 'export CLI_TOOLKIT_FW_BIN="%s"\n' "$LAUNCHER_DIR"
  printf 'export PATH="$CLI_TOOLKIT_FW_BIN:$PATH"\n'
  printf '# end cli-toolkit-fw\n'
} >> "$PROFILE"

printf '\n%s installed successfully.\n' "$CUSTOM_NAME"
printf 'Command: %s\n' "$CUSTOM_NAME"
printf 'UI name: %s\n' "$CUSTOM_NAME"
printf 'Install directory: %s\n' "$SCRIPT_DIR"
case "$(uname -s)" in
  Darwin) printf 'Log file: %s\n' "$HOME/Library/Logs/cli-toolkit-fw/cli-toolkit-fw.log" ;;
  *) printf 'Log file: %s\n' "${XDG_STATE_HOME:-$HOME/.local/state}/cli-toolkit-fw/cli-toolkit-fw.log" ;;
esac
printf 'Open a new terminal before running: %s\n' "$CUSTOM_NAME"

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
