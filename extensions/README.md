# Extensions

All user-created tools belong in this directory, one tool per child directory:

```text
extensions/
  my-tool/
    index.ts
    README.md
    commands/
    services/
```

Each `index.ts` must default-export the result of `defineTool(...)`. The framework discovers direct child directories automatically; no central registration file needs editing.

This file is informational. If the entire `extensions/` directory is deleted, the application starts normally with no tools registered.
