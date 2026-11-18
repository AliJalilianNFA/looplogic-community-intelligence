"""Local-only optional AI server for LoopLogic.
Run: OPENAI_API_KEY=<your key> python ai_server.py
On Windows PowerShell: $env:OPENAI_API_KEY='...'; python ai_server.py
Never put API keys in public HTML, JavaScript, or Git commits.
"""
import json
import os
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from screening import handle as handle_screening
from post_screening import build_plan
from geo_intelligence import summary as geo_summary, export_public as geo_export, sync_public_data, planning_insights, scenario as geo_scenario, direct_gtfs_journey

ROOT = Path(__file__).resolve().parent
KEY = os.environ.get('OPENAI_API_KEY', '').strip()
MODEL = os.environ.get('OPENAI_MODEL', 'gpt-4.1-mini').strip()
PORT = int(os.environ.get('LOOPLOGIC_PORT', '8000'))
MAX_REQUEST_BYTES = 12000
MAX_CALLS_PER_MINUTE = 12
CLIENT_CALLS = {}

INSTRUCTIONS = (
    'You are CivicPath, a careful AI navigation assistant in the LoopLogic Halifax community support prototype. '
    'The user explicitly opted in to sending a FICTIONAL resident/partner/government scenario to a model. '
    'Use only supplied local context and program references. Do not invent real-time availability, '
    'government eligibility approvals, calculated transit routes, verified funding or unseen sources. '
    'Offer clear, actionable, concise steps, say that screenings are preliminary, and quote official program '
    'URLs from context if useful. The service catalogue is curated; operating metrics and geographic gaps are '
    'entirely SYNTHETIC and must be identified as such. Be explicit about limitations and uncertainty. '
    'Do not request SIN, banking details, password, full medical records, or exact street address. '
    'Do not submit applications or imply that you can. '
    'For partner/government questions, suggest hypotheses and responsible next steps, never present demo '
    'performance figures as actual public health or program outcomes.'
)


def response_text(obj):
    if isinstance(obj.get('output_text'), str):
        return obj['output_text']
    pieces = []
    for item in obj.get('output', []):
        if item.get('type') != 'message':
            continue
        for block in item.get('content', []):
            if block.get('type') == 'output_text':
                pieces.append(block.get('text', ''))
    return '\n'.join(pieces).strip()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        # Deliberately suppress request bodies, names, addresses and upstream errors.
        print(f'[LoopLogic] {self.command} {self.path.split("?")[0]}')

    def send_json(self, status, data):
        blob = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Length', str(len(blob)))
        self.end_headers()
        self.wfile.write(blob)

    def do_GET(self):
        if self.path == '/api/status':
            return self.send_json(200, {'ready': bool(KEY), 'model': MODEL if KEY else None})
        if self.path == '/api/geo/status':
            return self.send_json(200, geo_summary())
        if self.path == '/api/geo/data':
            return self.send_json(200, geo_export())
        if self.path == '/api/geo/insights':
            return self.send_json(200, planning_insights())
        if self.path.startswith('/api/'):
            return self.send_json(404, {'error': 'Unknown API route'})
        return super().do_GET()

    def do_POST(self):
        if self.path not in ('/api/assist', '/api/screening', '/api/geo/sync', '/api/geo/scenario', '/api/geo/journey'):
            return self.send_json(404, {'error': 'Unknown API route'})
        if self.path in ('/api/geo/sync','/api/geo/scenario','/api/geo/journey'):
            # This server binds to 127.0.0.1 only. Explicit manual sync; never auto-scrape.
            if self.path == '/api/geo/sync':
                try:
                    return self.send_json(200, sync_public_data())
                except Exception as exc:
                    return self.send_json(503, {'error':'Public-data synchronization failed', 'detail':str(exc)[:160]})
            size = int(self.headers.get('Content-Length','0'))
            if size > 4000: return self.send_json(413,{'error':'Scenario request too large'})
            try:
                obj = json.loads(self.rfile.read(size).decode('utf-8')) if size else {}
                if self.path == '/api/geo/journey':
                    return self.send_json(200,direct_gtfs_journey(obj.get('da_id'),obj.get('provider_id'),obj.get('date')))
                return self.send_json(200,geo_scenario(obj.get('weeks',8),obj.get('cost',150),obj.get('capacity',25),obj.get('stop_id')))
            except (ValueError,TypeError,OverflowError) as exc:
                return self.send_json(400,{'error':'Invalid scenario inputs'})
        if self.path == '/api/assist' and not KEY:
            return self.send_json(503, {'mode': 'guided', 'error': 'No server-side API key configured'})
        size = int(self.headers.get('Content-Length', '0'))
        if size < 1 or size > MAX_REQUEST_BYTES:
            return self.send_json(413, {'error': 'Request too large'})
        ip = self.client_address[0]
        now = time.monotonic()
        CLIENT_CALLS[ip] = [t for t in CLIENT_CALLS.get(ip, []) if now-t < 60]
        if len(CLIENT_CALLS[ip]) >= MAX_CALLS_PER_MINUTE:
            return self.send_json(429, {'error': 'Demo limit reached; try again later'})
        CLIENT_CALLS[ip].append(now)
        try:
            obj = json.loads(self.rfile.read(size).decode('utf-8'))
            if not isinstance(obj, dict):
                raise ValueError('Not an object')
            mode = obj.get('mode')
            if mode not in ('resident', 'partner', 'government'):
                raise ValueError('Unsupported mode')
            message = obj.get('message', '')
            if not isinstance(message, str) or not message.strip() or len(message) > 2600:
                raise ValueError('Message invalid')
            context = {'mode': mode, 'message': message, 'profile': obj.get('profile', {}),
                       'service_catalogue': obj.get('services', [])}
        except (ValueError, UnicodeError):
            return self.send_json(400, {'error': 'Invalid request body'})
        if self.path == '/api/screening':
            if mode != 'resident':
                return self.send_json(400, {'error': 'Resident screening only'})
            session = obj.get('screening_session')
            program = obj.get('program')
            result = handle_screening(message, session, program)
            if result is None:
                return self.send_json(200, {'status':'not_screening', 'session':None})
            if result.get('status') == 'complete':
                result['plan'] = build_plan(result.get('session'))
            return self.send_json(200, result)
        payload = {
            'model': MODEL,
            'instructions': INSTRUCTIONS,
            'input': json.dumps(context, ensure_ascii=False),
            'max_output_tokens': 650,
            'store': False,
        }
        req = Request('https://api.openai.com/v1/responses',
                      data=json.dumps(payload).encode('utf-8'),
                      headers={'Authorization': 'Bearer ' + KEY,
                               'Content-Type': 'application/json'},
                      method='POST')
        try:
            with urlopen(req, timeout=30) as res:
                body = json.loads(res.read().decode('utf-8'))
            text = response_text(body)
            if not text:
                return self.send_json(502, {'mode': 'guided', 'error': 'Empty AI response'})
            return self.send_json(200, {'mode': 'generative', 'text': text[:5000]})
        except (HTTPError, URLError, TimeoutError, ValueError):
            return self.send_json(502, {'mode': 'guided', 'error': 'AI API unavailable; guided mode is still usable'})


if __name__ == '__main__':
    print('LoopLogic demo: http://127.0.0.1:%d' % PORT)
    print('Generative AI:', 'enabled' if KEY else 'not enabled (guided fallback only)')
    print('Local-only server. Do NOT expose it on a public network without proper auth, TLS, and security controls.')
    ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
