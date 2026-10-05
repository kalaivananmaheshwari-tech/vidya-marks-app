"""Read-only semantic PDF audit. QA dependency: pypdf==6.11.0 (install in ignored .cache/pdf-tools).
Run after test:e2e: PYTHONPATH=.cache/pdf-tools python3 scripts/verify-print-pdfs.py
No images/screenshots are generated; print-stress rows are synthetic DOM-only fixtures.
"""
import json
import re
from pathlib import Path
from pypdf import PdfReader

root = Path('.cache/print-verification')
manifest = json.loads((root / 'manifest.json').read_text())
checks = []
compact = lambda text: re.sub(r'\s+', '', text).upper()
for family in manifest:
    name = family['family']
    variants = ['normal', 'stress'] if name == 'comparative' else ['normal', 'portrait', 'stress']
    for variant in variants:
        file = root / f'{name}-{variant}.pdf'
        reader = PdfReader(file)
        landscape = variant == 'normal' and name != 'comparative'
        expected = (841.92, 594.96) if landscape else (594.96, 841.92)
        texts = [compact(page.extract_text() or '') for page in reader.pages]
        assert len(''.join(texts)) > 100, f'{file.name}: no meaningful extractable semantic text'
        assert all('ADMINACCESS' not in text and 'LOGOUT' not in text for text in texts), f'{file.name}: navigation leaked into PDF'
        raster_assets = []
        for page in reader.pages:
            dimensions = float(page.mediabox.width), float(page.mediabox.height)
            assert all(abs(got - want) < 1 for got, want in zip(dimensions, expected)), f'{file.name}: non-A4/orientation mismatch'
            xobjects = page.get('/Resources', {}).get('/XObject', {})
            if hasattr(xobjects, 'get_object'):
                xobjects = xobjects.get_object()
            raster_assets.extend({'width': obj.get_object().get('/Width'), 'height': obj.get_object().get('/Height')} for obj in xobjects.values() if obj.get_object().get('/Subtype') == '/Image')
            # Chromium can rasterize small chart/card decorations. Semantic table text/rows are
            # audited directly; the source is page.pdf on live HTML, never a screenshot image.
        signature_tokens = ['SUBJECTTEACHER' if name == 'subject' else 'CLASSTEACHER', 'HM/PRINCIPAL']
        if name == 'comparative':
            signature_tokens.append('PARENT')
        signature_pages = [i for i, text in enumerate(texts) if all(token in text for token in signature_tokens)]
        assert signature_pages, f'{file.name}: required signatures missing or split'
        repeated = 0
        if variant == 'stress':
            row_pages = set()
            for i in range(80):
                start, end = f'ST{i:03}', f'EN{i:03}'
                start_pages = [p for p, text in enumerate(texts) if start in text]
                end_pages = [p for p, text in enumerate(texts) if end in text]
                assert len(start_pages) == 1 and start_pages == end_pages, f'{file.name}: row {i} missing/split'
                row_pages.add(start_pages[0])
            assert len(row_pages) > 1, f'{file.name}: stress fixture did not span pages'
            assert all('PRINT_REPEAT_HEADER' in texts[p] for p in row_pages), f'{file.name}: header not repeated on a row-bearing page'
            repeated = len(row_pages)
        checks.append({'file': file.name, 'pages': len(reader.pages), 'a4': True, 'orientation': 'landscape' if landscape else 'portrait', 'semanticText': True, 'rasterDecorations': raster_assets, 'navigationAbsent': True, 'signaturesTogetherOnPages': [p + 1 for p in signature_pages], 'stressRowsUnsplit': 80 if variant == 'stress' else None, 'headerRepeatedOnRowPages': repeated or None})
(root / 'pdf-audit.json').write_text(json.dumps(checks, indent=2))
print(json.dumps({'verifiedFiles': len(checks), 'reportFamilies': len(manifest), 'screenshotPDFs': False, 'checks': checks}, indent=2))
