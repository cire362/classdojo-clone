"""Подсчёт людей на фото детекторами YOLOX-M и YOLOX-S (Apache-2.0) через ONNX Runtime (MIT).

Сервис только находит людей (класс COCO «person») и возвращает их рамки.
Никакого распознавания лиц и биометрии: нет эмбеддингов, нет сопоставления
с конкретными учениками. Изображение живёт только в памяти запроса.
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass

import numpy as np
import onnxruntime as ort
from PIL import Image

INPUT_SIZE = 640
PERSON_CLASS = 0
STRIDES = (8, 16, 32)


@dataclass
class Box:
    x: float
    y: float
    w: float
    h: float
    score: float

    def as_dict(self) -> dict:
        return {
            "x": round(self.x, 1),
            "y": round(self.y, 1),
            "w": round(self.w, 1),
            "h": round(self.h, 1),
            "score": round(self.score, 3),
        }


def _grids(size: int) -> tuple[np.ndarray, np.ndarray]:
    grids, strides = [], []
    for s in STRIDES:
        n = size // s
        xv, yv = np.meshgrid(np.arange(n), np.arange(n))
        g = np.stack((xv, yv), 2).reshape(1, -1, 2)
        grids.append(g)
        strides.append(np.full((1, g.shape[1], 1), s))
    return np.concatenate(grids, 1).astype(np.float32), np.concatenate(strides, 1).astype(np.float32)


def _iou(box: np.ndarray, boxes: np.ndarray) -> np.ndarray:
    x1 = np.maximum(box[0], boxes[:, 0])
    y1 = np.maximum(box[1], boxes[:, 1])
    x2 = np.minimum(box[2], boxes[:, 2])
    y2 = np.minimum(box[3], boxes[:, 3])
    inter = np.clip(x2 - x1, 0, None) * np.clip(y2 - y1, 0, None)
    area = (box[2] - box[0]) * (box[3] - box[1])
    areas = (boxes[:, 2] - boxes[:, 0]) * (boxes[:, 3] - boxes[:, 1])
    return inter / np.maximum(area + areas - inter, 1e-6), inter / np.maximum(areas, 1e-6)


def nms(boxes: np.ndarray, scores: np.ndarray, iou_thr: float) -> list[int]:
    """Классический NMS по IoU."""
    order = scores.argsort()[::-1]
    keep: list[int] = []
    while order.size:
        i = order[0]
        keep.append(int(i))
        rest = order[1:]
        iou, _ = _iou(boxes[i], boxes[rest])
        order = rest[iou <= iou_thr]
    return keep


def drop_tile_fragments(boxes: np.ndarray, from_tile: np.ndarray, keep: list[int], thr: float = 0.8) -> list[int]:
    """Убирает рамки из тайлов, почти целиком лежащие внутри другой найденной рамки:
    человек на краю тайла иногда даёт «половинку» (только верх туловища).
    Рамки общего прохода не трогаем — иначе стоящие в обнимку люди слипнутся в одного."""
    result = []
    for i in keep:
        if from_tile[i]:
            others = [j for j in keep if j != i]
            if others:
                x1 = np.maximum(boxes[i, 0], boxes[others, 0])
                y1 = np.maximum(boxes[i, 1], boxes[others, 1])
                x2 = np.minimum(boxes[i, 2], boxes[others, 2])
                y2 = np.minimum(boxes[i, 3], boxes[others, 3])
                inter = np.clip(x2 - x1, 0, None) * np.clip(y2 - y1, 0, None)
                area = (boxes[i, 2] - boxes[i, 0]) * (boxes[i, 3] - boxes[i, 1])
                if np.any(inter / max(area, 1e-6) > thr):
                    continue
        result.append(i)
    return result


def _session(model_path: str) -> ort.InferenceSession:
    opts = ort.SessionOptions()
    opts.intra_op_num_threads = int(os.environ.get("ORT_THREADS", "0")) or min(4, os.cpu_count() or 1)
    opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    return ort.InferenceSession(model_path, sess_options=opts, providers=["CPUExecutionProvider"])


class PeopleCounter:
    """Общий проход по всему фото — точной моделью (YOLOX-M). На групповых фото
    дополнительно смотрим фото по кусочкам (тайлам) быстрой моделью (YOLOX-S): мелкие
    фигуры в заднем ряду при этом «увеличиваются» и находятся заметно лучше."""

    def __init__(
        self,
        model_path: str,
        score_threshold: float = 0.35,
        nms_threshold: float = 0.45,
        tile_model_path: str | None = None,
        tile_score_threshold: float = 0.30,
        tile_px: int = 448,
        max_tiles_per_side: int = 4,
    ):
        self.session = _session(model_path)
        self.tile_session = _session(tile_model_path) if tile_model_path else self.session
        self.score_threshold = score_threshold
        self.nms_threshold = nms_threshold
        self.tile_score_threshold = tile_score_threshold
        self.tile_px = tile_px
        self.max_tiles_per_side = max_tiles_per_side
        self._grid, self._stride = _grids(INPUT_SIZE)

    def _infer(self, img: np.ndarray, session: ort.InferenceSession | None = None, threshold: float | None = None) -> tuple[np.ndarray, np.ndarray]:
        """img — RGB uint8 HxWx3. Возвращает рамки (x1,y1,x2,y2) в координатах img и уверенность."""
        session = session or self.session
        threshold = self.score_threshold if threshold is None else threshold
        h, w = img.shape[:2]
        r = min(INPUT_SIZE / h, INPUT_SIZE / w)
        nh, nw = max(1, int(h * r)), max(1, int(w * r))
        resized = np.asarray(Image.fromarray(img).resize((nw, nh), Image.BILINEAR), dtype=np.uint8)
        padded = np.full((INPUT_SIZE, INPUT_SIZE, 3), 114, dtype=np.uint8)
        padded[:nh, :nw] = resized
        # Модели YOLOX обучены на BGR без нормализации
        blob = np.ascontiguousarray(padded[:, :, ::-1].transpose(2, 0, 1)[None], dtype=np.float32)

        out = session.run(None, {session.get_inputs()[0].name: blob})[0][0]
        xy = (out[:, :2] + self._grid[0]) * self._stride[0]
        wh = np.exp(out[:, 2:4]) * self._stride[0]
        scores = out[:, 4] * out[:, 5 + PERSON_CLASS]
        mask = scores >= threshold
        xy, wh, scores = xy[mask], wh[mask], scores[mask]
        boxes = np.concatenate([xy - wh / 2, xy + wh / 2], axis=1) / r
        boxes[:, [0, 2]] = boxes[:, [0, 2]].clip(0, w)
        boxes[:, [1, 3]] = boxes[:, [1, 3]].clip(0, h)
        return boxes, scores

    def _tile_origins(self, w: int, h: int) -> tuple[int, list[int], list[int]]:
        """Квадратные тайлы ~448 px с перекрытием 25%; на больших фото тайлы крупнее,
        чтобы их было не больше max_tiles_per_side по каждой стороне (ограничение по времени)."""
        longer = max(w, h)
        size = max(self.tile_px, int(np.ceil(longer / (1 + 0.75 * (self.max_tiles_per_side - 1)))))
        size = min(size, w, h)
        step = max(1, int(size * 0.75))

        def axis(total: int) -> list[int]:
            pos = list(range(0, max(1, total - size + 1), step))
            if pos[-1] != total - size:
                pos.append(total - size)
            return pos

        return size, axis(w), axis(h)

    def count(self, image: Image.Image, tiles: bool | None = None) -> dict:
        started = time.perf_counter()
        img = np.asarray(image.convert("RGB"), dtype=np.uint8)
        h, w = img.shape[:2]

        all_boxes, all_scores, all_tile = [], [], []
        b, s = self._infer(img)
        all_boxes.append(b)
        all_scores.append(s)
        all_tile.append(np.zeros(len(b), dtype=bool))

        # Тайлы включаем на групповых фото: общий проход ничего не нашёл,
        # нашёл много людей или в основном мелкие фигуры
        if tiles is None:
            people = b[nms(b, s, self.nms_threshold)] if len(b) else b
            heights = (people[:, 3] - people[:, 1]) / h
            tiles = min(h, w) >= 480 and (
                len(people) == 0 or len(people) >= 8 or float(np.median(heights)) < 0.35
            )
        if tiles:
            size, xs, ys = self._tile_origins(w, h)
            for y0 in ys:
                for x0 in xs:
                    tb, ts = self._infer(img[y0 : y0 + size, x0 : x0 + size], self.tile_session, self.tile_score_threshold)
                    # Рамки, упирающиеся во внутреннюю границу тайла, — это «обрезанные» люди:
                    # их целиком найдёт общий проход или соседний тайл
                    m = max(4, 0.03 * size)
                    cut = np.zeros(len(tb), dtype=bool)
                    if x0 > 0:
                        cut |= tb[:, 0] <= m
                    if x0 + size < w:
                        cut |= tb[:, 2] >= size - m
                    if y0 > 0:
                        cut |= tb[:, 1] <= m
                    if y0 + size < h:
                        cut |= tb[:, 3] >= size - m
                    tb, ts = tb[~cut], ts[~cut]
                    tb[:, [0, 2]] += x0
                    tb[:, [1, 3]] += y0
                    all_boxes.append(tb)
                    all_scores.append(ts)
                    all_tile.append(np.ones(len(tb), dtype=bool))

        boxes = np.concatenate(all_boxes)
        scores = np.concatenate(all_scores)
        from_tile = np.concatenate(all_tile)
        # Отбрасываем вырожденные рамки
        valid = ((boxes[:, 2] - boxes[:, 0]) > 4) & ((boxes[:, 3] - boxes[:, 1]) > 4)
        boxes, scores, from_tile = boxes[valid], scores[valid], from_tile[valid]
        keep = nms(boxes, scores, self.nms_threshold) if len(scores) else []
        keep = drop_tile_fragments(boxes, from_tile, keep)

        result = [
            Box(float(x1), float(y1), float(x2 - x1), float(y2 - y1), float(scores[i]))
            for i in keep
            for x1, y1, x2, y2 in [boxes[i]]
        ]
        result.sort(key=lambda bx: (bx.x, bx.y))
        return {
            "count": len(result),
            "width": w,
            "height": h,
            "boxes": [bx.as_dict() for bx in result],
            "elapsedMs": round((time.perf_counter() - started) * 1000),
        }
