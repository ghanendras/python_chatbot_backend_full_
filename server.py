"""Small standard-library server for the Minimal Chat app."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import os
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT / "public"

def load_env():
    env_file = ROOT / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))

class Handler(BaseHTTPRequestHandler):
    def send_json(self, status, value):
        data = json.dumps(value).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        if self.path != "/api/chat":
            return self.send_json(404, {"error": "Not found."})
        key = os.environ.get("GROQ_API_KEY")
        if not key:
            return self.send_json(500, {"error": "GROQ_API_KEY is missing. Add it to .env and restart."})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > 100_000:
                return self.send_json(413, {"error": "Request is too large."})
            body = json.loads(self.rfile.read(length) or b"{}")
            messages = body.get("messages")
            if not isinstance(messages, list) or not messages:
                return self.send_json(400, {"error": "Send at least one message."})
            safe_messages = []
            for msg in messages[-20:]:
                if msg.get("role") not in ("user", "assistant") or not isinstance(msg.get("content"), str):
                    return self.send_json(400, {"error": "Messages must have a user or assistant role and text content."})
                safe_messages.append({"role": msg["role"], "content": msg["content"][:8000]})
            payload = json.dumps({
                "model": "llama-3.3-70b-versatile",
                "messages": safe_messages,
                "temperature": 0.7,
                "max_tokens": 1024,
            }).encode()
            request = urllib.request.Request(
                "https://api.groq.com/openai/v1/chat/completions",
                data=payload,
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(request, timeout=60) as response:
                result = json.loads(response.read())
            reply = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            return self.send_json(200, {"reply": reply})
        except urllib.error.HTTPError as error:
            try:
                result = json.loads(error.read())
                detail = result.get("error", {}).get("message", "The AI service could not complete the request.")
            except Exception:
                detail = "The AI service could not complete the request."
            return self.send_json(429 if error.code == 429 else 502, {"error": detail})
        except (json.JSONDecodeError, UnicodeDecodeError):
            return self.send_json(400, {"error": "Invalid JSON request."})
        except Exception as error:
            return self.send_json(502, {"error": str(error) or "Could not reach the AI service."})

    def do_GET(self):
        name = "index.html" if self.path == "/" else self.path.lstrip("/").split("?", 1)[0]
        path = (PUBLIC / name).resolve()
        if PUBLIC.resolve() not in path.parents:
            self.send_error(403)
            return
        try:
            data = path.read_bytes()
        except (FileNotFoundError, IsADirectoryError):
            self.send_error(404)
            return
        content_type = {".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8"}.get(path.suffix, "application/octet-stream")
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        print(fmt % args)

if __name__ == "__main__":
    load_env()
    port = int(os.environ.get("PORT", "3000"))
    server = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"Minimal Chat is running at http://localhost:{port}", flush=True)
    server.serve_forever()
