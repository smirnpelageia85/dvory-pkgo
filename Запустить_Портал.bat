@echo off
chcp 65001 > nul
title Портал Дворы ПКГО — локальный просмотр
cd /d "%~dp0"
echo Дворы ПКГО: 10 дворов, 58 концепций, 116 рендеров.
echo Локальный адрес: http://127.0.0.1:8765/
echo Для просмотра без сервера используйте Открыть_напрямую_в_браузере.bat
echo.
python --version > nul 2>&1
if errorlevel 1 goto direct
python -X utf8 -c "from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler; from functools import partial; from pathlib import Path; import webbrowser; server=ThreadingHTTPServer(('127.0.0.1',8765),partial(SimpleHTTPRequestHandler,directory=str(Path.cwd()))); webbrowser.open('http://127.0.0.1:8765/index.html?offline=1'); server.serve_forever()"
echo.
echo Сервер остановлен или порт 8765 занят. Доступен прямой просмотр index.html.
pause
exit /b
:direct
echo Python не найден. Открывается автономный просмотр без сервера.
start "" "%~dp0index.html"
