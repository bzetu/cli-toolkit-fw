# Installation design

The root scripts install the framework in place; they do not copy the project elsewhere.

Both installers ask for a command name. Empty input selects `toolkit`. The value must start with a letter or number, contain only letters, numbers, `.`, `_`, or `-`, and be no longer than 40 characters. The selected value becomes both the terminal command and UI title.

Windows installation:

- checks for Bun and installs it only when missing;
- installs locked dependencies;
- runs typecheck and tests;
- creates a name-specific launcher under `.cli-toolkit-fw/launchers/`;
- records `CLI_TOOLKIT_FW_HOME`, `CLI_TOOLKIT_FW_NAME`, and `CLI_TOOLKIT_FW_BIN` as user environment variables;
- removes the previously recorded launcher directory from user PATH after a move or rename;
- adds the current name-specific launcher directory once;
- waits for any key before closing after a successful interactive installation.

Linux/macOS installation:

- checks for Bun and installs it only when missing;
- installs locked dependencies and validates the project;
- creates a name-specific launcher under `.cli-toolkit-fw/launchers/`;
- writes one marked shell-profile block containing `CLI_TOOLKIT_FW_HOME`, `CLI_TOOLKIT_FW_NAME`, `CLI_TOOLKIT_FW_BIN`, and PATH;
- replaces the previous marked block when reinstalled;
- waits for any key before closing after a successful interactive installation.

Uninstallers only remove the PATH/environment registration created by the framework. They do not delete launchers, Bun, `node_modules`, source code, configuration, or logs.

If the project directory moves, run the installer again from the new directory.

To change the command/UI name, run the installer again and enter a new name. The old launcher file is retained, but its directory is removed from PATH and is therefore no longer registered as a command.
