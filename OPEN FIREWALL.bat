@echo off
echo Opening firewall for Kess Kiosk...
netsh advfirewall firewall add rule name="Kess App Port 3000" dir=in action=allow protocol=TCP localport=3000
netsh advfirewall firewall add rule name="Kess App Port 4000" dir=in action=allow protocol=TCP localport=4000
echo.
echo Done! Both ports are now open.
echo Dell can now connect to the kiosk.
pause
