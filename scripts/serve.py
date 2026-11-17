#!/usr/bin/env python3
"""Static server for the story site.

Same as `python3 -m http.server`, except archived images under assets/bad
and assets/obsolete are not served.
"""

from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

BLOCKED = ("/assets/bad", "/assets/obsolete")


class Handler(SimpleHTTPRequestHandler):
    def _blocked(self):
        path = self.path.split("?", 1)[0]
        return path == "/assets/bad" or path.startswith("/assets/bad/") or path == "/assets/obsolete" or path.startswith("/assets/obsolete/")

    def do_GET(self):
        if self._blocked():
            self.send_error(404, "Not found")
            return
        super().do_GET()

    def do_HEAD(self):
        if self._blocked():
            self.send_error(404, "Not found")
            return
        super().do_HEAD()


if __name__ == "__main__":
    ThreadingHTTPServer(("", 8080), Handler).serve_forever()
