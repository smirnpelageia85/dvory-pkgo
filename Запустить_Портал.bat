@echo off
chcp 65001 > nul
cd /d "%~dp0"
echo Дворы ПКГО: локальный портал и редактор МАФов.
echo Адрес: http://127.0.0.1:8771/00_ОТКРЫТЬ.html
python --version > nul 2>&1
if errorlevel 1 goto direct
python -X utf8 -c "from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler; import webbrowser; server=ThreadingHTTPServer(('127.0.0.1',8771),SimpleHTTPRequestHandler); webbrowser.open('http://127.0.0.1:8771/00_ОТКРЫТЬ.html'); server.serve_forever()"
pause
exit /b
:direct
echo Python не найден. Открывается просмотр; экспорт монтажа доступен в онлайн-редакторе.
start "" "%~dp000_ОТКРЫТЬ.html"
