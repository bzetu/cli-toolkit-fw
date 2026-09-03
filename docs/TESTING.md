# Testing

All tests belong under `test/`. Do not place temporary test scripts in the repository root.

Required checks:

```text
bun run typecheck
bun test
```

Test command behavior by calling `run` directly. Inject or isolate network, filesystem, clock, and process behavior so tests do not modify the user's machine.

At minimum, cover:

- normal command output;
- invalid or missing configuration;
- external command failure;
- selection callback behavior;
- destructive-operation confirmation;
- formatting with Chinese and ASCII content when tables are used.
- extension discovery and the missing-`extensions/` default state.

Do not use real API keys, personal accounts, production URLs, or live destructive resources in fixtures.
