"""Сервис просмотра документов: превращает Word, Excel, PowerPoint и OpenDocument в PDF.

Файл приходит телом POST /convert, расширение — в заголовке X-Extension. Работает только с временной
папкой и сразу её удаляет: документы нигде не сохраняются. Конвертация по одной, чтобы LibreOffice
не съел всю память на слабом сервере. Только стандартная библиотека Python.
"""
import os
import shutil
import subprocess
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ALLOWED = {'doc', 'docx', 'odt', 'rtf', 'xls', 'xlsx', 'ods', 'ppt', 'pptx', 'odp'}
MAX_BYTES = int(os.environ.get('MAX_BYTES', str(25 * 1024 * 1024)))
TIMEOUT = int(os.environ.get('CONVERT_TIMEOUT', '90'))
LOCK = threading.Lock()


def convert(data: bytes, extension: str) -> bytes:
    """PDF из документа или исключение, если LibreOffice не справился"""
    workdir = tempfile.mkdtemp(prefix='convert-')
    try:
        source = os.path.join(workdir, f'document.{extension}')
        with open(source, 'wb') as f:
            f.write(data)
        # Отдельный профиль на каждый запуск: зависший прошлый процесс не блокирует следующий
        profile = f'file://{workdir}/profile'
        with LOCK:
            subprocess.run(
                ['soffice', f'-env:UserInstallation={profile}', '--headless', '--norestore', '--nologo',
                 '--convert-to', 'pdf', '--outdir', workdir, source],
                check=True, timeout=TIMEOUT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            )
        with open(os.path.join(workdir, 'document.pdf'), 'rb') as f:
            return f.read()
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


class Handler(BaseHTTPRequestHandler):
    def _send(self, status: int, body: bytes = b'', content_type: str = 'text/plain; charset=utf-8'):
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):  # noqa: N802
        if self.path == '/health':
            self._send(200, b'ok')
        else:
            self._send(404, b'not found')

    def do_POST(self):  # noqa: N802
        if self.path != '/convert':
            return self._send(404, b'not found')
        extension = (self.headers.get('X-Extension') or '').lower()
        if extension not in ALLOWED:
            return self._send(415, 'Формат не поддерживается'.encode())
        length = int(self.headers.get('Content-Length') or 0)
        if length <= 0 or length > MAX_BYTES:
            return self._send(413, 'Файл слишком большой'.encode())
        data = self.rfile.read(length)
        try:
            pdf = convert(data, extension)
        except (subprocess.SubprocessError, OSError):
            return self._send(422, 'Не удалось открыть документ'.encode())
        self._send(200, pdf, 'application/pdf')

    def log_message(self, *args):  # Имена и содержимое документов в журнал не пишем
        pass


def main():
    port = int(os.environ.get('PORT', '8000'))
    ThreadingHTTPServer(('0.0.0.0', port), Handler).serve_forever()


if __name__ == '__main__':
    main()
