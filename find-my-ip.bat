@echo off
echo ================================================
echo NETWORK DIAGNOSTICS - Find Your Computer's IP
echo ================================================
echo.

echo Your Network Interfaces:
echo.
ipconfig | findstr /i "IPv4 Wireless Ethernet"
echo.

echo ================================================
echo INSTRUCTIONS:
echo ================================================
echo.
echo 1. Look for "IPv4 Address" under:
echo    - "Wireless LAN adapter Wi-Fi" (if using WiFi)
echo    - "Ethernet adapter Ethernet" (if using cable)
echo.
echo 2. Your IP usually looks like:
echo    - 192.168.0.xxx
echo    - 192.168.1.xxx
echo    - 10.0.0.xxx
echo.
echo 3. Create client\.env with that IP:
echo    VITE_SERVER_URL=http://YOUR_IP:3001
echo.
echo 4. Example:
echo    VITE_SERVER_URL=http://192.168.0.105:3001
echo.
echo ================================================
echo.
pause
