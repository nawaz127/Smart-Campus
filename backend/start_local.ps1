$env:USE_SQLITE = "true"
$env:USE_ASYNC_TASKS = "false"
$env:ENABLE_REALTIME_PUSH = "false"

& "$PSScriptRoot\.venv\Scripts\python.exe" "$PSScriptRoot\manage.py" runserver 127.0.0.1:8000
