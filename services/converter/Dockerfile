FROM debian:bookworm-slim

# LibreOffice (MPL-2.0) — отдельная программа, которую сервис только запускает.
# Шрифты DejaVu и Liberation (свободные лицензии) нужны, чтобы кириллица в документах не превращалась в квадраты.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    libreoffice-writer libreoffice-calc libreoffice-impress \
    fonts-dejavu-core fonts-liberation2 python3 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /srv
COPY app ./app
COPY tests ./tests

RUN useradd --system --create-home --home-dir /home/converter converter
USER converter
# Профиль LibreOffice пишется во временную папку: файловая система контейнера только для чтения
ENV HOME=/tmp PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
EXPOSE 8000
CMD ["python3", "-m", "app.main"]
