import os
import sys


def _install_log_tee():
    log_dir = os.environ.get(
        'SCHERZO_LOG_DIR',
        os.path.join(os.path.expanduser('~'), '.npcsh', 'scherzo', 'logs'),
    )
    try:
        os.makedirs(log_dir, exist_ok=True)
    except OSError:
        return
    log_path = os.path.join(log_dir, 'backend.log')
    try:
        fh = open(log_path, 'a', buffering=1)
    except OSError:
        return

    class _Tee:
        def __init__(self, underlying, file_handle):
            self._u = underlying
            self._f = file_handle
        def write(self, data):
            try:
                self._u.write(data)
            except Exception:
                pass
            try:
                self._f.write(data)
            except Exception:
                pass
        def flush(self):
            for s in (self._u, self._f):
                try:
                    s.flush()
                except Exception:
                    pass
        def __getattr__(self, name):
            return getattr(self._u, name)

    sys.stdout = _Tee(sys.stdout, fh)
    sys.stderr = _Tee(sys.stderr, fh)


_install_log_tee()

from npcpy.serve import start_flask_server

if __name__ == "__main__":
    if sys.argv[1:] == ['--test-import']:
        print("[TEST] Importing npcpy.serve...")
        from npcpy.serve import app
        print("[TEST] All imports OK")
        sys.exit(0)

    is_frozen = getattr(sys, 'frozen', False)
    is_dev = not is_frozen

    default_port = '7139' if is_dev else '5139'
    port = os.environ.get('SCHERZO_PORT', default_port)
    frontend_port = os.environ.get('FRONTEND_PORT', '7339' if port == '7139' else '6339')

    mode_str = 'dev' if is_dev else 'prod'
    print(f"Starting Flask server on http://0.0.0.0:{port} ({mode_str} mode)")

    start_flask_server(
        port=port,
        cors_origins=f"localhost:{frontend_port}",
        db_path=os.path.expanduser('~/.npcsh/scherzo/scherzo.db'),
        user_npc_directory=os.path.expanduser('~/.npcsh/npc_team'),
        debug=False)
