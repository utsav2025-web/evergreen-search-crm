#!/bin/bash
set -e

echo "=== EVERGREEN SEARCH CRM STARTUP ==="
echo "Timestamp: $(date)"
echo "PORT=${PORT:-NOT SET}"
echo "Python: $(python --version)"
echo "Working dir: $(pwd)"
echo "PYTHONUNBUFFERED=${PYTHONUNBUFFERED}"

# Background heartbeat: prints every 10 seconds so we can see if the container is still alive
(
  COUNT=0
  while true; do
    COUNT=$((COUNT+10))
    MEM=$(awk '/MemAvailable/{print $2}' /proc/meminfo 2>/dev/null || echo "?")
    echo "HEARTBEAT +${COUNT}s | MemAvailable=${MEM}kB | PIDS=$(ls /proc | grep -E '^[0-9]+$' | wc -l)"
    sleep 10
  done
) &
echo "HEARTBEAT pid=$! started"

echo ""
echo "=== Running Alembic migrations ==="
alembic upgrade head
echo "=== Alembic done ==="

echo ""
echo "=== Testing Python import ==="
python -c "
import sys
print('Python path:', sys.path[:3])
try:
    import app.main
    print('IMPORT OK: app.main loaded successfully')
except Exception as e:
    print('IMPORT FAILED:', type(e).__name__, str(e))
    import traceback
    traceback.print_exc()
    sys.exit(1)
"
echo "=== Import test done ==="

echo ""
echo "=== Starting uvicorn on port ${PORT:-8000} ==="
exec python -m uvicorn app.main:app \
    --host 0.0.0.0 \
    --port "${PORT:-8000}" \
    --log-level info
