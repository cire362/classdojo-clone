FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv

COPY requirements.txt requirements-dev.txt ./
RUN pip install --no-cache-dir -r requirements-dev.txt

# Модель YOLOX (Apache-2.0) из официального релиза Megvii-BaseDetection/YOLOX.
# yolox_m — точнее на групповых фото, yolox_s — быстрее и легче.
# Если модель уже лежит в services/detector/models, повторно она не скачивается.
ARG YOLOX_MODEL=yolox_m
COPY models/ ./models/
COPY scripts ./scripts
RUN python scripts/fetch_model.py ${YOLOX_MODEL} models \
  && find models -name '*.onnx' ! -name "${YOLOX_MODEL}.onnx" -delete \
  && mv models/${YOLOX_MODEL}.onnx models/model.onnx
ENV MODEL_PATH=/srv/models/model.onnx

COPY app ./app
COPY tests ./tests
COPY pytest.ini ./

RUN useradd --system --no-create-home detector
USER detector
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
