"""Скачивает модель YOLOX (Apache-2.0) из официального релиза, если её ещё нет,
и проверяет контрольную сумму. Используется при сборке Docker-образа."""

import hashlib
import os
import sys
import urllib.request

MODELS = {
    "yolox_s": "c5c2d13e59ae883e6af3b45daea64af4833a4951c92d116ec270d9ddbe998063",
    "yolox_m": "21ff6cfdeb53b013bac2249599e55f00bff3cfdfdab37ed7a4620818c1d15b3f",
}
BASE = "https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/"


def sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main(name: str, models_dir: str) -> None:
    if name not in MODELS:
        sys.exit(f"Неизвестная модель {name}; доступны: {', '.join(MODELS)}")
    path = os.path.join(models_dir, f"{name}.onnx")
    if os.path.exists(path) and sha256(path) == MODELS[name]:
        print(f"{path}: уже есть")
        return
    print(f"Скачиваю {name}.onnx …")
    urllib.request.urlretrieve(BASE + f"{name}.onnx", path)
    if sha256(path) != MODELS[name]:
        os.remove(path)
        sys.exit("Контрольная сумма модели не совпала")
    print(f"{path}: готово")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "yolox_m", sys.argv[2] if len(sys.argv) > 2 else "models")
