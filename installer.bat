@echo off
title Minecraft Scanner Installer
echo ---------------------------------------
echo Minecraft Server Scanner Installer
echo ---------------------------------------
echo.

REM Check if Node is installed
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not found in PATH.
    echo Please install Node.js from https://nodejs.org/ and try again.
    pause
    exit /b
)

echo Installing dependencies...
call npm install

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b
)

echo.
echo ---------------------------------------
echo Installation Complete!
echo ---------------------------------------
echo.
echo To start the scanner, you can run 'start_scanner.bat' (creating it now...)

echo @echo off > start_scanner.bat
echo node index.js >> start_scanner.bat
echo pause >> start_scanner.bat

echo.
echo [SUCCESS] 'start_scanner.bat' has been created. Double-click it to run the tool.
pause
