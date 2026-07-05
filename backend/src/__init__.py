"""Marks the ``src`` directory as a regular Python package.

This is intentionally empty. It exists so that ``python -m src.app.main``
works (which lets uvicorn find the ``app`` package without needing the
``PYTHONPATH=src`` env-var trick that is bash-only).

With this file in place, on Windows PowerShell you can run:

    python -m uvicorn src.app.main:app --reload --port 8000

without first exporting ``PYTHONPATH``. The application code does not
rely on this — it can also be reached via the ``src.app.main:app`` import
string once ``src`` is on ``sys.path`` (which ``pytest`` and ``alembic``
arrange for themselves via ``pyproject.toml`` and ``alembic/env.py``).
"""
