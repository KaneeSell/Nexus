@echo off
setlocal
set "NEXUS_APP_EXE=%~dp0..\..\Nexus.exe"
set "NEXUS_RESOURCES_DIR=%~dp0.."

where node >nul 2>&1
if %errorlevel%==0 (
  if exist "%~dp0..\cli\index.js" (
    node "%~dp0..\cli\index.js" %*
    exit /b %errorlevel%
  )
)

set "RAW_TARGET=%~1"
if "%RAW_TARGET%"=="" set "RAW_TARGET=."

pushd "%RAW_TARGET%" >nul 2>&1
if errorlevel 1 (
  set "TARGET=%RAW_TARGET%"
) else (
  set "TARGET=%CD%"
  popd
)

start "" "%NEXUS_APP_EXE%" --target="%TARGET%"
endlocal
