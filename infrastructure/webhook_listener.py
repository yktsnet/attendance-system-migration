import os
from http.server import BaseHTTPRequestHandler, HTTPServer
import subprocess

class WebhookHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        print("\n🔔 Webhook received! Triggering CI/CD...")
        # 自身と同じディレクトリにある ci.sh を実行
        script_dir = os.path.dirname(os.path.abspath(__file__))
        subprocess.run([os.path.join(script_dir, "ci.sh")])
        
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"OK")

port = int(os.environ.get("PORT", 9000))
print(f"📡 Webhook Listener started on port {port}...")
HTTPServer(('localhost', port), WebhookHandler).serve_forever()
