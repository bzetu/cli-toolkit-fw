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
- broadcasts the Windows environment change and verifies that the selected command resolves from the updated process PATH;
- waits for any key before closing after a successful interactive installation.

Linux/macOS installation:

- checks for Bun and installs it only when missing;
- installs locked dependencies and validates the project;
- creates a name-specific launcher under `.cli-toolkit-fw/launchers/`;
- writes one marked shell-profile block containing `CLI_TOOLKIT_FW_HOME`, `CLI_TOOLKIT_FW_NAME`, `CLI_TOOLKIT_FW_BIN`, and PATH;
- replaces the previous marked block when reinstalled;
- waits for any key before closing after a successful interactive installation.

Uninstallers remove the PATH/environment registration created by the framework, the generated `.cli-toolkit-fw/` launcher directory, and the generated `node_modules/` dependency directory inside the project. Before recursive removal, the Windows script verifies that each resolved directory is the expected direct child of the current project; the POSIX script accepts only the exact expected paths.

Uninstallers do not delete Bun, source code, extensions, extension configuration, or logs. Dependencies can be restored later by running the installer or `bun install --frozen-lockfile`. After a successful interactive uninstall, both scripts wait for a key press before closing.

If the project directory moves, run the installer again from the new directory.

To change the command/UI name, run the installer again and enter a new name. The previous name-specific directory is removed from PATH. Generated launcher files remain until the uninstall script removes the complete `.cli-toolkit-fw/` directory.

Windows Terminal keeps environment variables in its main process. If it was already running during installation, opening only a new tab may still use the old PATH. Close every Windows Terminal window and start the application again, or run the command in the same PowerShell process that invoked the installer directly with `./install-windows.ps1`.
