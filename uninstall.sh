#!/usr/bin/env sh
set -eu

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

printf 'cli-toolkit-fw environment registration was removed.\n'
printf 'Shell environment block removed: %s\n' "$PROFILE_CHANGED"
printf 'No project files, launchers, dependencies, configuration, or logs were deleted.\n'
printf 'Open a new terminal for the environment changes to take effect.\n'
