@echo off
echo ====================================
echo Debug Video Source Selection
echo ====================================
echo.

echo Step 1: Check current video status
curl -s http://localhost:3000/api/video
echo.
echo.

echo Step 2: Switch to uploaded video
curl -s -X POST http://localhost:3000/api/video -F "action=switchSource" -F "source=upload"
echo.
echo.

echo Step 3: Verify switch
curl -s http://localhost:3000/api/video
echo.
