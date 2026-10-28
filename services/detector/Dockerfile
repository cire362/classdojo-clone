FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv

COPY requirements.txt requirements-dev.txt ./
RUN pip install --no-cache-dir -r requirements-dev.txt

# Модели YOLOX (Apache-2.0) из официального релиза Megvii-BaseDetection/YOLOX.
# Если модель уже лежит в services/detector/models, повторно она не скачивается.
# Основная модель (общий проход) и быстрая модель для тайлов на групповых фото.
ARG YOLOX_MODEL=yolox_m
ARG YOLOX_TILE_MODEL=yolox_s
COPY models/ ./models/
COPY scripts ./scripts
RUN python scripts/fetch_model.py ${YOLOX_MODEL} models \
  && python scripts/fetch_model.py ${YOLOX_TILE_MODEL} models \
  && cp models/${YOLOX_MODEL}.onnx models/model.onnx \
  && cp models/${YOLOX_TILE_MODEL}.onnx models/tile.onnx \
  && find models -name '*.onnx' ! -name model.onnx ! -name tile.onnx -delete
ENV MODEL_PATH=/srv/models/model.onnx TILE_MODEL_PATH=/srv/models/tile.onnx

COPY app ./app
COPY tests ./tests
COPY pytest.ini ./

RUN useradd --system --no-create-home detector
USER detector
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
