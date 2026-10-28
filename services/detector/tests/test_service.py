"""Тесты сервиса подсчёта людей.

Запуск: docker compose run --rm detector pytest -q
(или локально: pip install -r requirements-dev.txt && MODEL_PATH=models/yolox_m.onnx pytest -q)
"""

import io
import os
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image, ImageDraw

from app.main import app

IMAGES = Path(__file__).parent / "images"


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def post_image(client: TestClient, data: bytes, ctype: str = "image/jpeg"):
    return client.post("/count", content=data, headers={"Content-Type": ctype})


def jpeg_bytes(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def test_health(client):
    assert client.get("/health").json() == {"ok": True}


@pytest.mark.parametrize(
    "name, expected, tolerance",
    [
        ("crew_4_people.jpg", 4, 0),
        ("crew_7_people.jpg", 7, 0),
        # Старое (1897 г.) выцветшее групповое фото, лица в заднем ряду едва различимы —
        # допускаем погрешность в 4 человека. Преподаватель всё равно сверяет список вручную.
        ("class_37_people.jpg", 37, 4),
    ],
)
def test_counts_people(client, name, expected, tolerance):
    started = time.perf_counter()
    r = post_image(client, (IMAGES / name).read_bytes())
    elapsed = time.perf_counter() - started
    assert r.status_code == 200, r.text
    body = r.json()
    assert abs(body["count"] - expected) <= tolerance, f"{name}: найдено {body['count']}, ожидалось {expected}"
    assert len(body["boxes"]) == body["count"]
    for b in body["boxes"]:
        assert 0 <= b["x"] <= body["width"] and 0 <= b["y"] <= body["height"]
        assert b["w"] > 0 and b["h"] > 0
    # Требование: ответ до ~3 секунд на CPU
    assert elapsed < float(os.environ.get("MAX_SECONDS", "3")), f"{name}: {elapsed:.2f} с"


def test_no_people_on_empty_scene(client):
    img = Image.new("RGB", (1024, 768), (180, 200, 230))
    d = ImageDraw.Draw(img)
    d.rectangle((100, 400, 500, 700), fill=(120, 80, 40))
    d.ellipse((650, 100, 850, 300), fill=(250, 220, 60))
    r = post_image(client, jpeg_bytes(img))
    assert r.status_code == 200
    assert r.json()["count"] == 0


def test_exif_rotation_is_respected(client):
    """Фото с телефона часто повёрнуто через EXIF — размеры в ответе должны быть «правильными»."""
    img = Image.open(IMAGES / "crew_4_people.jpg").rotate(90, expand=True)  # лежит на боку
    exif = Image.Exif()
    exif[0x0112] = 6  # при показе повернуть на 90° по часовой
    buf = io.BytesIO()
    img.save(buf, format="JPEG", exif=exif)
    body = post_image(client, buf.getvalue()).json()
    assert body["width"] > body["height"]
    assert body["count"] == 4


def test_rejects_non_image(client):
    assert post_image(client, b"hello", "text/plain").status_code == 415
    assert post_image(client, b"definitely not a jpeg", "image/jpeg").status_code == 400
    assert post_image(client, b"", "image/jpeg").status_code == 400


def test_photo_is_not_written_to_disk(client, tmp_path, monkeypatch):
    """Во время обработки сервис не создаёт файлов (ни во временной папке, ни в рабочей)."""
    import tempfile

    watched = [Path(tempfile.gettempdir()), Path.cwd()]
    before = {p: set(p.rglob("*")) for p in watched}
    r = post_image(client, (IMAGES / "crew_7_people.jpg").read_bytes())
    assert r.status_code == 200
    for p in watched:
        assert set(p.rglob("*")) == before[p], f"появились новые файлы в {p}"
