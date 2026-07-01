#!/bin/bash
set -e

echo "==> Esperando base de datos..."
python -c "
import time, psycopg2, os
url = os.environ.get('DATABASE_URL_SYNC', '')
for i in range(30):
    try:
        conn = psycopg2.connect(url)
        conn.close()
        print('Base de datos lista.')
        break
    except Exception as e:
        print(f'  Intento {i+1}/30: {e}')
        time.sleep(2)
"

echo "==> Ejecutando migraciones Alembic..."
alembic upgrade head

echo "==> Iniciando servidor FastAPI..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
