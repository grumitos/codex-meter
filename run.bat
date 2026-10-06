@echo off
rem Codex Meter: starts the Windows controller from source and opens the pairing page.
rem The first run installs the bridge dependencies (npm ci --omit=dev). Stop it with Ctrl+C.
rem Usage: run.bat [--self-test FILE]   e.g.: run.bat --self-test check.json
setlocal
cd /d "%~dp0"
set "MIN_NODE=22"
set "CODEX_METER_RUN=1"
set "EXIT_CODE=0"

rem With a double click (cmd /c "...\run.bat") there is a final pause only if something fails; if all
rem goes well, the pairing page opens in the browser and this window is the controller.
set "DOUBLE_CLICK="
echo %cmdcmdline% | "%SystemRoot%\System32\find.exe" /i "%~nx0" >nul && set "DOUBLE_CLICK=1"

rem Only --self-test FILE is understood; anything else would just start the controller.
rem This stays out of a CALL because "call :label /?" prints the help of CALL instead.
if "%~1"=="" goto :arguments_ok
if /i "%~1"=="--self-test" if not "%~2"=="" if "%~3"=="" goto :arguments_ok
if /i "%~1"=="--help" goto :usage
if /i "%~1"=="-h" goto :usage
if /i "%~1"=="/?" goto :usage
echo ERROR: unknown or incomplete arguments.
set "EXIT_CODE=2"
goto :usage

:arguments_ok
call :find_node || goto :failed
if not exist "bridge\node_modules\.package-lock.json" (
    call :install_dependencies || goto :failed
)

if "%~1"=="" echo Starting Codex Meter. The pairing page opens in your browser; press Ctrl+C to stop.
node bridge\src\windows-app.mjs %*
set "EXIT_CODE=%ERRORLEVEL%"
rem Ctrl+C is not a failure: Windows reports it as 0xC000013A.
if "%EXIT_CODE%"=="-1073741510" set "EXIT_CODE=0"
if not "%EXIT_CODE%"=="0" echo ERROR: Codex Meter stopped (code %EXIT_CODE%). See %LOCALAPPDATA%\CodexMeter\controller.log
goto :finish

:usage
echo Usage: run.bat [--self-test FILE]
echo   --self-test FILE   write the private address and Node.js version to FILE, then exit
goto :finish

:find_node
rem Checks that Node.js %MIN_NODE% or newer is on the PATH.
node -e "process.exit(+process.versions.node.split('.')[0] >= %MIN_NODE% ? 0 : 1)" >nul 2>&1 && exit /b 0
echo ERROR: Node.js %MIN_NODE% or newer is required on the PATH (https://nodejs.org).
exit /b 1

:install_dependencies
echo Installing the controller dependencies (first run only)...
pushd bridge || exit /b 1
call npm ci --omit=dev
set "NPM_EXIT=%ERRORLEVEL%"
popd
if not "%NPM_EXIT%"=="0" echo ERROR: npm ci failed. Check the network connection and that npm is on the PATH.
exit /b %NPM_EXIT%

:failed
set "EXIT_CODE=1"

:finish
if defined DOUBLE_CLICK if not "%EXIT_CODE%"=="0" pause
exit /b %EXIT_CODE%
