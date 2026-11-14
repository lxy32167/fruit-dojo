from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from pathlib import Path
import socket
import os
port = int(os.environ.get('PORT', '5175'))
root = Path(__file__).resolve().parent / 'dist'
server = ThreadingHTTPServer(('0.0.0.0', port), partial(SimpleHTTPRequestHandler, directory=str(root)))
print(f'电脑试玩：http://localhost:{port}', flush=True)
try:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.connect(('192.0.2.1', 80))
    print(f'iPad 同一 Wi-Fi：http://{sock.getsockname()[0]}:{port}', flush=True)
    sock.close()
except OSError:
    pass
try:
    server.serve_forever()
except KeyboardInterrupt:
    server.server_close()
