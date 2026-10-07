#!/usr/bin/env python3
"""Regenerate the standalone Arabic HTML from the Markdown guide.

Uses the Markdown parser that lives in build-guide-pdf.py, so the HTML and the
PDF always come from the same structure.

    python docs/build-guide-html.py
"""
import html as html_mod
import importlib.util
import re
import sys

spec = importlib.util.spec_from_file_location('bg', 'docs/build-guide-pdf.py')
bg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bg)

def esc(t: str) -> str:
    t = bg.LINK.sub(r'\1', t)
    t = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', t)
    t = re.sub(r'(?<!\*)\*([^*]+)\*(?!\*)', r'<em>\1</em>', t)
    t = re.sub(r'`([^`]+)`', r'<code>\1</code>', t)
    return t

source = bg.SOURCE.read_text(encoding='utf-8')
lines = source.split('\n')
title = lines[0][2:].strip() if lines[0].startswith('# ') else 'دليل'
rest = '\n'.join(lines[1:])
blocks = bg.Blocks(rest).parse()

out = []
for b in blocks:
    kind = b[0]
    if kind == 'h':
        out.append(f'<h{b[1]}>{esc(b[2])}</h{b[1]}>')
    elif kind == 'p':
        out.append(f'<p>{esc(b[1])}</p>')
    elif kind in ('ul', 'ol'):
        tag = 'ul' if kind == 'ul' else 'ol'
        items = ''.join(f'<li>{esc(i)}</li>' for i in b[1])
        out.append(f'<{tag}>{items}</{tag}>')
    elif kind == 'table':
        rows = b[1]
        head, body = rows[0], rows[1:]
        thead = '<tr>' + ''.join(f'<th>{esc(c)}</th>' for c in head) + '</tr>'
        tbody = ''.join('<tr>' + ''.join(f'<td>{esc(c)}</td>' for c in r) + '</tr>' for r in body)
        out.append(f'<table><thead>{thead}</thead><tbody>{tbody}</tbody></table>')
    elif kind == 'quote':
        inner = ''.join(f'<p>{esc(l)}</p>' for l in b[1])
        out.append(f'<blockquote>{inner}</blockquote>')
    elif kind == 'code':
        body = html_mod.escape('\n'.join(b[1]))
        out.append(f'<pre><code>{body}</code></pre>')
    elif kind == 'hr':
        out.append('<hr />')

css = """
:root{--ink:#1b2430;--muted:#5b6b7c;--line:#e2e8f0;--bg:#f7f9fc;--card:#fff;--brand:#0f766e;--brand-soft:#ecfdf5;--accent:#b45309;--accent-soft:#fffbeb;--code:#0f172a}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:"Segoe UI","Noto Naskh Arabic","Amiri",Tahoma,system-ui,sans-serif;font-size:17px;line-height:1.95}
.wrap{max-width:960px;margin:0 auto;padding:40px 24px 96px}
header.hero{background:linear-gradient(135deg,#0f766e,#115e59 55%,#134e4a);color:#fff;border-radius:20px;padding:38px 34px;margin-bottom:34px;box-shadow:0 16px 40px -18px rgba(15,118,110,.55)}
header.hero h1{margin:0 0 10px;font-size:2.1rem;line-height:1.4;font-weight:800}
header.hero p{margin:6px 0;opacity:.94;font-size:1.02rem}
header.hero .creds{display:inline-block;margin-top:14px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.28);border-radius:999px;padding:7px 18px;font-size:.95rem;font-weight:600}
h2{font-size:1.5rem;margin:52px 0 16px;padding-bottom:10px;border-bottom:3px solid var(--brand);font-weight:800}
h3{font-size:1.2rem;margin:34px 0 10px;font-weight:700}
h4{font-size:1.05rem;margin:24px 0 8px;color:var(--muted);font-weight:700}
p{margin:12px 0}
a{color:var(--brand);text-decoration:none;border-bottom:1px solid rgba(15,118,110,.35)}
ul,ol{padding-inline-start:26px;margin:12px 0}
li{margin:6px 0}
hr{border:0;border-top:1px solid var(--line);margin:44px 0}
blockquote{margin:18px 0;padding:14px 20px;background:var(--accent-soft);border-inline-start:5px solid var(--accent);border-radius:10px;color:#7c2d12}
blockquote p{margin:6px 0}
code{background:#eef2f6;border:1px solid var(--line);border-radius:6px;padding:2px 7px;font-family:ui-monospace,Menlo,monospace;font-size:.88em;direction:ltr;display:inline-block}
pre{background:var(--code);color:#e2e8f0;padding:18px 20px;border-radius:12px;overflow:auto;direction:ltr;text-align:left;font-size:.9rem;line-height:1.7}
pre code{background:none;border:0;color:inherit;padding:0;display:block}
table{width:100%;border-collapse:separate;border-spacing:0;margin:20px 0;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(16,24,40,.05);font-size:.97rem}
thead th{background:#f1f5f9;text-align:right;font-weight:700;padding:12px 14px;border-bottom:1px solid var(--line);white-space:nowrap}
tbody td{padding:11px 14px;border-bottom:1px solid #eef2f6;vertical-align:top}
tbody tr:last-child td{border-bottom:0}
tbody tr:nth-child(even){background:#fbfcfe}
tbody tr:hover{background:var(--brand-soft)}
@media print{body{background:#fff;font-size:12pt}header.hero{-webkit-print-color-adjust:exact;print-color-adjust:exact}h2{page-break-after:avoid}table,blockquote,pre{page-break-inside:avoid}.wrap{max-width:none;padding:0}}
"""

doc = f"""<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{html_mod.escape(title)}</title>
<style>{css}</style>
</head>
<body>
<div class="wrap">
<header class="hero">
<h1>{html_mod.escape(title)}</h1>
<p>من الصفر إلى فهم كل عملية محاسبية في النظام — بأمثلة حقيقية من بيانات التطبيق.</p>
<p>كل الأرقام في هذا الدليل مأخوذة من شركة <strong style="color:#fff">Demo Company Inc.</strong> التجريبية.</p>
<span class="creds">للدخول إلى التطبيق: admin@demo.local / Admin@12345</span>
</header>
{chr(10).join(out)}
</div>
</body>
</html>"""

target = bg.DOCS / 'دليل-المحاسبة-بالعربية.html'
target.write_text(doc, encoding='utf-8')
print('HTML rebuilt:', target, len(doc), 'bytes')
