@echo off
powershell -Command "$s=(New-Object -COM WScript.Shell).CreateShortcut('%USERPROFILE%\Desktop\Kess Kiosk.lnk');$s.TargetPath='C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe';$s.Arguments='--app=https://stupendous-gingersnap-618d44.netlify.app/kiosk --start-fullscreen';$s.IconLocation='C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe,0';$s.Description='Kess Hair and Beauty Kiosk';$s.Save()"
echo Done! Kess Kiosk icon added to Desktop.
pause
