"""Проверка в контейнере: docker compose run --rm --no-deps converter python3 -m unittest -v tests.test_convert"""
import http.client
import io
import threading
import unittest
import zipfile
from http.server import ThreadingHTTPServer

from app.main import Handler, convert

CONTENT_TYPES = (
    '<?xml version="1.0" encoding="UTF-8"?>'
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    '<Default Extension="xml" ContentType="application/xml"/>'
    '<Override PartName="/word/document.xml" '
    'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
    '</Types>'
)
RELS = (
    '<?xml version="1.0" encoding="UTF-8"?>'
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
    'Target="word/document.xml"/></Relationships>'
)
DOCUMENT = (
    '<?xml version="1.0" encoding="UTF-8"?>'
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'
    '<w:p><w:r><w:t>Методичка: дроби</w:t></w:r></w:p></w:body></w:document>'
)


def docx() -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w') as z:
        z.writestr('[Content_Types].xml', CONTENT_TYPES)
        z.writestr('_rels/.rels', RELS)
        z.writestr('word/document.xml', DOCUMENT)
    return buf.getvalue()


class ConvertTest(unittest.TestCase):
    def test_docx_to_pdf(self):
        pdf = convert(docx(), 'docx')
        self.assertTrue(pdf.startswith(b'%PDF-'))

    def test_rejects_unknown_format_and_empty_body(self):
        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            for headers, body, status in [({'X-Extension': 'html'}, b'<script>', 415), ({'X-Extension': 'docx'}, b'', 413)]:
                conn = http.client.HTTPConnection('127.0.0.1', server.server_address[1])
                conn.request('POST', '/convert', body=body, headers=headers)
                self.assertEqual(conn.getresponse().status, status)
        finally:
            server.shutdown()


if __name__ == '__main__':
    unittest.main()
