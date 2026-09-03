# Extensions

All user-created tools belong in the repository-root `extensions/` directory, one tool per child directory:

```text
extensions/
  my-tool/
    index.ts
    README.md
    commands/
    services/
    test/
```

Each `index.ts` must default-export the result of `defineTool(...)`. The framework discovers direct child directories automatically; no central registration file needs editing.

The contents of `extensions/` are intentionally ignored by Git. Only `extensions/.gitkeep` is tracked so that a fresh clone contains the empty extension mount point. This prevents local tools, credentials, service addresses, and machine-specific behavior from being pushed to the framework repository.

Tests that belong only to a local extension should stay inside that extension's `test/` directory. Framework-level tests remain in the root `test/` directory.

If an extension directory is deleted, that tool disappears on the next application launch. If the entire `extensions/` directory is deleted, the application starts normally in its default empty state.
