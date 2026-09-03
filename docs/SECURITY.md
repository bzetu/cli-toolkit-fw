# Security

Tool code runs with the current user's permissions. Treat every AI-generated tool as normal executable source code and review sensitive operations before use.

Required rules:

- Keep credentials out of tracked files.
- Prefer environment variables or a gitignored local configuration file.
- Redact `authorization`, `token`, `apiKey`, `password`, `cookie`, and similar fields before logging.
- Do not print full request headers or secret-bearing URLs.
- Use process argument arrays instead of shell interpolation.
- Validate filesystem paths before delete, overwrite, or recursive operations.
- Ask for confirmation before irreversible actions.
- Document network endpoints and external executable requirements in the tool README.
- Never silently elevate privileges, modify PATH, install software, kill processes, or execute downloaded scripts.

The framework log is intended for errors, not application secrets or full external service responses.
