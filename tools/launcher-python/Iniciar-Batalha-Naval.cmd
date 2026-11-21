@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>&1
if not errorlevel 1 (
    py -3 "%~dp0gui.py"
) else (
    where python >nul 2>&1
    if not errorlevel 1 (
        python "%~dp0gui.py"
    ) else (
        echo Python nao encontrado. Instale Python 3.10+ com Tkinter em https://www.python.org/downloads/windows/
        pause
        exit /b 1
    )
)
if errorlevel 1 (
    echo O inicializador terminou com erro. Verifique a instalacao do Python.
    pause
)
endlocal