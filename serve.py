#!/usr/bin/env python3
"""Serve this complete HTML website locally. Requires Python 3 only."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import webbrowser


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--no-browser', action='store_true')
    args = parser.parse_args()
    root = Path(__file__).resolve().parent
    handler = partial(SimpleHTTPRequestHandler, directory=str(root))
    try:
        server = ThreadingHTTPServer(('127.0.0.1', args.port), handler)
    except OSError:
        if args.port != 8000:
            raise
        server = ThreadingHTTPServer(('127.0.0.1', 0), handler)
    url = f'http://127.0.0.1:{server.server_address[1]}/'
    print(f'Serving the website at {url}', flush=True)
    print('Leave this window open. Press Ctrl+C to stop.', flush=True)
    if not args.no_browser:
        opener = threading.Timer(0.4, lambda: webbrowser.open(url))
        opener.daemon = True
        opener.start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nWebsite server stopped.')
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
