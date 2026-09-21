"""
Launcher for the FastAPI backend.

The backend splits across two import roots — `app.*` lives in backend/ and `ml.*` lives at
the repository root — so uvicorn needs both on the path. Rather than making every developer
remember to export PYTHONPATH, this script sets it up and starts the server.

    python tools/serve_api.py                # 127.0.0.1:8000 with autoreload
    python tools/serve_api.py --port 9000
    python tools/serve_api.py --no-reload    # quieter, for smoke tests and CI

The reload flag matters here: uvicorn's reloader spawns a child process, and sys.path edits
made in this process are not inherited. Only the PYTHONPATH environment variable is, which
is why it is set explicitly below.
"""

from __future__ import annotations

import argparse
import os
import socket
import sys
import time
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
BACKEND_ROOT = PROJECT_ROOT / "backend"


def is_port_in_use(host: str, port: int) -> bool:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            return s.connect_ex((host, port)) == 0
    except OSError:
        return False


def _configure_import_paths() -> None:
    for path in (PROJECT_ROOT, BACKEND_ROOT):
        entry = str(path)
        if entry not in sys.path:
            sys.path.insert(0, entry)

    # Inherited by the autoreload child process.
    existing = os.environ.get("PYTHONPATH", "")
    wanted = os.pathsep.join([str(PROJECT_ROOT), str(BACKEND_ROOT)])
    os.environ["PYTHONPATH"] = f"{wanted}{os.pathsep}{existing}" if existing else wanted


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the MediShelf AI backend.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument(
        "--no-reload",
        dest="reload",
        action="store_false",
        help="Disable autoreload.",
    )
    parser.add_argument("--log-level", default="info")
    parser.set_defaults(reload=True)
    args = parser.parse_args()

    _configure_import_paths()

    try:
        import uvicorn
    except ModuleNotFoundError:
        print(
            "uvicorn is not installed in the active interpreter.\n"
            "  pip install torch==2.6.0 torchvision==0.21.0 "
            "--index-url https://download.pytorch.org/whl/cpu\n"
            "  pip install -r backend/requirements.txt",
            file=sys.stderr,
        )
        return 1

    # The SQLite file and its seed are resolved relative to the working directory, so pin
    # it to the repo root regardless of where the command was invoked from.
    os.chdir(PROJECT_ROOT)

    # If another instance or server is already listening, stay alive gracefully
    if is_port_in_use(args.host, args.port):
        print(f"MediShelf AI API is already running at http://{args.host}:{args.port}")
        try:
            while True:
                time.sleep(3600)
        except KeyboardInterrupt:
            return 0

    print(f"MediShelf AI API -> http://{args.host}:{args.port}  (docs at /docs)")

    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        reload=args.reload,
        reload_dirs=[str(BACKEND_ROOT)] if args.reload else None,
        log_level=args.log_level,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
