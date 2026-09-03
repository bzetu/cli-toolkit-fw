@echo off
chcp 65001 >nul
set "CLI_TOOLKIT_FW_LOG=%LOCALAPPDATA%\cli-toolkit-fw\logs\cli-toolkit-fw.log"
pushd "%~dp0"
bun run "src\index.tsx" %*
set "CLI_TOOLKIT_FW_EXIT=%ERRORLEVEL%"
popd
if not "%CLI_TOOLKIT_FW_EXIT%"=="0" (
  echo.
  echo cli-toolkit-fw failed. Log: %CLI_TOOLKIT_FW_LOG%
  pause
)
exit /b %CLI_TOOLKIT_FW_EXIT%
