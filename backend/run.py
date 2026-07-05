"""Run the FastAPI dev server with proper sys.path setup.

This is the cross-platform equivalent of:

    bash:    PYTHONPATH=src uvicorn src.app.main:app --reload
    cmd:     set PYTHONPATH=src && uvicorn src.app.main:app --reload
    powershell:  $env:PYTHONPATH='src'; uvicorn src.app.main:app --reload

It exists because the bash-style ``VAR=cmd`` and the cmd ``set VAR=val && cmd``
syntaxes do not work natively in PowerShell, and managing PYTHONPATH by hand
is error-prone on Windows. The script:

  1. Adds the ``src/`` directory to ``sys.path`` so the ``app`` package
     is importable without setting PYTHONPATH.
  2. Delegates to uvicorn programmatically (same as the CLI).

Usage from the ``backend/`` directory:

    # After activating the venv (see Backend_Setup.md step 5):
    python run.py                     # default: 127.0.0.1:8000, no reload
    python run.py --reload            # hot-reload on file changes
    python run.py --port 9000         # custom port
    python run.py --host 0.0.0.0      # bind all interfaces
    python run.py --help              # full uvicorn CLI help

The script intentionally avoids reading CLI defaults of its own; all flags
forward straight to uvicorn. This keeps the behaviour identical whether
you invoke it through ``python run.py`` or the installed ``uvicorn`` entry
point.
"""

from __future__ import annotations

import sys
from pathlib import Path

_SRC = Path(__file__).resolve().parent / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))


def main() -> None:
    import uvicorn

    # Default the APP positional to ``src.app.main:app`` so users can run
    # ``python run.py --reload`` without remembering the import string.
    # Any explicit APP arg still wins because uvicorn parses argv itself
    # and we only set the default when it is missing.
    if "APP" not in sys.argv[1:]:
        # Look for any non-flag argument that looks like a module path.
        has_app = any(
            (not a.startswith("-")) and ":" in a
            for a in sys.argv[1:]
        )
        if not has_app:
            sys.argv.insert(1, "src.app.main:app")

    uvicorn.main()


if __name__ == "__main__":
    main()
