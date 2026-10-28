"""HTTP-сервис подсчёта людей на фото.

POST /count — тело запроса: само изображение (Content-Type: image/*).
Мы сознательно не используем multipart: парсер multipart в Starlette сбрасывает
файлы больше 1 МБ во временный файл на диске, а фото не должны попадать на диск.
Изображение читается в память, обрабатывается и сразу освобождается.
"""

from __future__ import annotations

import io
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from PIL import Image, ImageOps, UnidentifiedImageError

from .detector import PeopleCounter

MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "models")
MODEL_PATH = os.environ.get("MODEL_PATH", os.path.join(MODELS_DIR, "yolox_m.onnx"))
# Быстрая модель для тайлов на групповых фото; пустая строка — использовать основную
TILE_MODEL_PATH = os.environ.get("TILE_MODEL_PATH", os.path.join(MODELS_DIR, "yolox_s.onnx"))
MAX_BYTES = int(os.environ.get("MAX_BYTES", str(15 * 1024 * 1024)))
MAX_SIDE = int(os.environ.get("MAX_SIDE", "2000"))
# Защита от «бомб» распаковки
Image.MAX_IMAGE_PIXELS = 60_000_000

counter: PeopleCounter | None = None


@asynccontextmanager
async def lifespan(_: FastAPI):
    global counter
    counter = PeopleCounter(
        MODEL_PATH,
        score_threshold=float(os.environ.get("SCORE_THRESHOLD", "0.35")),
        nms_threshold=float(os.environ.get("NMS_THRESHOLD", "0.45")),
        tile_model_path=TILE_MODEL_PATH if TILE_MODEL_PATH and os.path.exists(TILE_MODEL_PATH) else None,
        tile_score_threshold=float(os.environ.get("TILE_SCORE_THRESHOLD", "0.30")),
        tile_px=int(os.environ.get("TILE_PX", "448")),
    )
    yield


app = FastAPI(title="Герои класса: подсчёт людей", lifespan=lifespan)


@app.get("/health")
def health() -> dict:
    return {"ok": counter is not None}


async def _read_limited(request: Request) -> bytes:
    length = request.headers.get("content-length")
    if length and int(length) > MAX_BYTES:
        raise HTTPException(413, "Файл слишком большой")
    buf = bytearray()
    async for chunk in request.stream():
        buf.extend(chunk)
        if len(buf) > MAX_BYTES:
            raise HTTPException(413, "Файл слишком большой")
    return bytes(buf)


def _process(data: bytes) -> dict:
    assert counter is not None
    try:
        with Image.open(io.BytesIO(data)) as raw:
            img = ImageOps.exif_transpose(raw).convert("RGB")
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as e:
        raise HTTPException(400, "Не удалось прочитать изображение") from e

    # Слишком большие фото уменьшаем для скорости, рамки возвращаем в исходных координатах
    w, h = img.size
    scale = min(1.0, MAX_SIDE / max(w, h))
    if scale < 1.0:
        img = img.resize((round(w * scale), round(h * scale)), Image.BILINEAR)
    result = counter.count(img)
    del img
    if scale < 1.0:
        for b in result["boxes"]:
            for k in ("x", "y", "w", "h"):
                b[k] = round(b[k] / scale, 1)
        result["width"], result["height"] = w, h
    return result


@app.post("/count")
async def count(request: Request) -> dict:
    ctype = request.headers.get("content-type", "")
    if not ctype.startswith("image/"):
        raise HTTPException(415, "Ожидается изображение (Content-Type: image/*)")
    data = await _read_limited(request)
    if not data:
        raise HTTPException(400, "Пустой файл")
    try:
        return await run_in_threadpool(_process, data)
    finally:
        del data
