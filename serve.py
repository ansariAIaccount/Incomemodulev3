#!/usr/bin/env python3
"""
Static server for the PCS Loan Module — with caching turned OFF.

Why this exists
---------------
`python -m http.server` sends Last-Modified but no Cache-Control and no ETag.
With neither, Chrome applies *heuristic* caching: it decides for itself how long
the file is fresh and serves it from cache WITHOUT asking the server. A tab you
leave open never re-fetches at all.

That produced two separate false diagnoses in one day:

  1. The app appeared not to load external deals. The code was correct; the
     browser was running JavaScript from before the fix.
  2. A parser fix appeared not to work. Adding ?v=N to the page URL busts the
     HTML but NOT `portf-excel-parser.js`, which is a separate request with no
     query string — so the page was new and the parser was old.

Both times the symptom pointed at the application and the cause was the server.
Correctness beats caching for a local dev tool, so every response here says
no-store: the browser must re-fetch, every time, including the .js files.

Usage
-----
    python3 serve.py            # serves this directory on http://localhost:8080
    python3 serve.py 8081       # different port

Run it from the directory that holds loan-module-v4-builder.html.
"""

import sys
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # no-store is the strong one: do not write to cache at all. The other
        # two are belt and braces for intermediaries and older browsers.
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):
        # One line per request, without the date noise.
        sys.stderr.write("%s\n" % (fmt % args))


if __name__ == '__main__':
    # Serve the CURRENT directory, exactly like `python -m http.server` does —
    # NOT the directory this file happens to live in. serve.py sits at the repo
    # root while loan-module-v4-builder.html is a level down, so chdir'ing to
    # the script's own folder would silently change every URL.
    srv = ThreadingHTTPServer(('127.0.0.1', PORT), NoCacheHandler)
    here = os.getcwd()
    app = os.path.join(here, 'loan-module-v4-builder.html')
    print('PCS Loan Module — no-cache static server')
    print('  serving : %s' % here)
    print('  url     : http://localhost:%d/loan-module-v4-builder.html' % PORT)
    print('  caching : disabled (Cache-Control: no-store on every response)')
    print('  stop    : Ctrl-C')
    if not os.path.exists(app):
        print('')
        print('  WARNING: loan-module-v4-builder.html is not in this directory.')
        print('           You are almost certainly in the wrong folder — the URL')
        print('           above will 404. cd to the folder holding the app first.')
    print('')
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print('\nstopped')
