import urllib.request
import io
import json

svg_content = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 600" width="100%" height="100%">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#1e293b" />
    </linearGradient>
    <linearGradient id="card" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e293b" />
      <stop offset="100%" stop-color="#334155" />
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0d9488" />
      <stop offset="100%" stop-color="#0284c7" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1000" height="600" rx="16" fill="url(#bg)" />
  <rect x="2" y="2" width="996" height="596" rx="14" fill="none" stroke="#334155" stroke-width="1.5" />

  <!-- Header -->
  <g transform="translate(50, 45)">
    <rect x="0" y="0" width="40" height="40" rx="8" fill="url(#accent)" />
    <text x="20" y="26" font-family="system-ui, sans-serif" font-size="18" font-weight="bold" fill="#ffffff" text-anchor="middle">CW</text>
    <text x="54" y="20" font-family="system-ui, sans-serif" font-size="20" font-weight="bold" fill="#f8fafc">Acme Corp Enterprise Architecture</text>
    <text x="54" y="38" font-family="system-ui, sans-serif" font-size="12" fill="#94a3b8">Zero-Trust Cloud Infrastructure, Multi-Tenant Isolation &amp; Neon DB Topology</text>
  </g>

  <!-- Node 1: Client Gateway -->
  <g transform="translate(50, 140)">
    <rect width="240" height="120" rx="10" fill="url(#card)" stroke="#475569" stroke-width="1.5" />
    <circle cx="24" cy="28" r="8" fill="#38bdf8" />
    <text x="40" y="32" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#f8fafc">Next.js Frontend &amp; CDN</text>
    <text x="20" y="60" font-family="system-ui, sans-serif" font-size="11" fill="#94a3b8">• Enterprise App Shell</text>
    <text x="20" y="80" font-family="system-ui, sans-serif" font-size="11" fill="#94a3b8">• Client-side State &amp; SSE Stream</text>
    <text x="20" y="100" font-family="system-ui, sans-serif" font-size="11" fill="#38bdf8">• Inter Font Design System</text>
  </g>

  <!-- Node 2: API Gateway & Service Layer -->
  <g transform="translate(380, 140)">
    <rect width="260" height="120" rx="10" fill="url(#card)" stroke="#0d9488" stroke-width="2" />
    <circle cx="24" cy="28" r="8" fill="#14b8a6" />
    <text x="40" y="32" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#f8fafc">FastAPI Core Engine</text>
    <text x="20" y="60" font-family="system-ui, sans-serif" font-size="11" fill="#94a3b8">• Modular Monolith Architecture</text>
    <text x="20" y="80" font-family="system-ui, sans-serif" font-size="11" fill="#94a3b8">• Role-Based Access Control</text>
    <text x="20" y="100" font-family="system-ui, sans-serif" font-size="11" fill="#14b8a6">• Batch-Optimized Query Layer</text>
  </g>

  <!-- Node 3: AI Agents -->
  <g transform="translate(730, 140)">
    <rect width="220" height="120" rx="10" fill="url(#card)" stroke="#818cf8" stroke-width="1.5" />
    <circle cx="24" cy="28" r="8" fill="#818cf8" />
    <text x="40" y="32" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#f8fafc">Gen AI Agents</text>
    <text x="20" y="60" font-family="system-ui, sans-serif" font-size="11" fill="#94a3b8">• KNOW Grounded RAG</text>
    <text x="20" y="80" font-family="system-ui, sans-serif" font-size="11" fill="#94a3b8">• PLAN &amp; MOVE Agents</text>
    <text x="20" y="100" font-family="system-ui, sans-serif" font-size="11" fill="#818cf8">• Gemini 1.5 Flash Provider</text>
  </g>

  <!-- Connectors Row 1 -->
  <path d="M 290 200 L 380 200" stroke="#38bdf8" stroke-width="2" stroke-dasharray="4,4" />
  <polygon points="375,196 385,200 375,204" fill="#38bdf8" />

  <path d="M 640 200 L 730 200" stroke="#14b8a6" stroke-width="2" stroke-dasharray="4,4" />
  <polygon points="725,196 735,200 725,204" fill="#14b8a6" />

  <!-- Node 4: Neon Cloud Database -->
  <g transform="translate(180, 340)">
    <rect width="280" height="140" rx="10" fill="url(#card)" stroke="#10b981" stroke-width="2" />
    <circle cx="24" cy="28" r="8" fill="#10b981" />
    <text x="40" y="32" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#f8fafc">Neon Cloud PostgreSQL</text>
    <text x="20" y="60" font-family="system-ui, sans-serif" font-size="11" fill="#94a3b8">• Region: ap-southeast-1</text>
    <text x="20" y="80" font-family="system-ui, sans-serif" font-size="11" fill="#94a3b8">• Branch: production</text>
    <text x="20" y="100" font-family="system-ui, sans-serif" font-size="11" fill="#94a3b8">• Auto-scaling Serverless Storage</text>
    <text x="20" y="120" font-family="system-ui, sans-serif" font-size="11" fill="#10b981">• 114 Engagements &amp; Outcomes</text>
  </g>

  <!-- Node 5: Document & Vector Storage -->
  <g transform="translate(540, 340)">
    <rect width="280" height="140" rx="10" fill="url(#card)" stroke="#f59e0b" stroke-width="1.5" />
    <circle cx="24" cy="28" r="8" fill="#f59e0b" />
    <text x="40" y="32" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#f8fafc">Knowledge Store &amp; Artifacts</text>
    <text x="20" y="60" font-family="system-ui, sans-serif" font-size="11" fill="#94a3b8">• Vector Embeddings &amp; Chunks</text>
    <text x="20" y="80" font-family="system-ui, sans-serif" font-size="11" fill="#94a3b8">• Native PDF &amp; Image Storage</text>
    <text x="20" y="100" font-family="system-ui, sans-serif" font-size="11" fill="#94a3b8">• Privacy Scrubbing Engine</text>
    <text x="20" y="120" font-family="system-ui, sans-serif" font-size="11" fill="#f59e0b">• Tenant Isolation Enforcement</text>
  </g>

  <!-- Connectors Row 2 -->
  <path d="M 460 260 L 350 340" stroke="#10b981" stroke-width="2" />
  <polygon points="351,332 346,343 358,340" fill="#10b981" />

  <path d="M 550 260 L 660 340" stroke="#f59e0b" stroke-width="2" />
  <polygon points="652,340 664,343 659,332" fill="#f59e0b" />

  <!-- Security Footer Badge -->
  <g transform="translate(50, 525)">
    <rect width="900" height="40" rx="8" fill="#1e293b" stroke="#334155" stroke-width="1" />
    <text x="20" y="25" font-family="system-ui, sans-serif" font-size="12" font-weight="600" fill="#10b981">SECURITY CHECKED:</text>
    <text x="160" y="25" font-family="system-ui, sans-serif" font-size="12" fill="#94a3b8">SOC2 Type II &amp; ISO 27001 Compliant &bull; Zero Cross-Tenant Data Leaks &bull; TLS 1.3 End-to-End</text>
  </g>
</svg>"""

boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
body = io.BytesIO()
body.write(f'--{boundary}\r\n'.encode('utf-8'))
body.write(b'Content-Disposition: form-data; name="category"\r\n\r\n')
body.write(b'Architecture\r\n')

body.write(f'--{boundary}\r\n'.encode('utf-8'))
body.write(b'Content-Disposition: form-data; name="title"\r\n\r\n')
body.write(b'Cloud Infrastructure Architecture Topology\r\n')

body.write(f'--{boundary}\r\n'.encode('utf-8'))
body.write(b'Content-Disposition: form-data; name="file"; filename="Cloud_Infrastructure_Architecture_Topology.svg"\r\n')
body.write(b'Content-Type: image/svg+xml\r\n\r\n')
body.write(svg_content.encode('utf-8'))
body.write(b'\r\n')
body.write(f'--{boundary}--\r\n'.encode('utf-8'))

req = urllib.request.Request(
    'http://127.0.0.1:8000/api/v1/engagements/eng-acme-001/documents/upload-file',
    data=body.getvalue(),
    headers={'Content-Type': f'multipart/form-data; boundary={boundary}'}
)

with urllib.request.urlopen(req) as resp:
    res_data = json.loads(resp.read().decode('utf-8'))
    print('Uploaded Status:', resp.status)
    print('Document Info:', res_data.get('data'))
