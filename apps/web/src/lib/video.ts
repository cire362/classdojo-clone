const WAIT_MS = 10_000;

/**
 * Обложка видео: кадр около полсекунды от начала, снятый браузером. Сервер видео не декодирует.
 * null, если браузер не смог открыть ролик (например, HEVC в Chrome без поддержки): запись уйдёт без обложки.
 */
export function videoPoster(file: Blob, maxSide = 1280): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    let settled = false;
    const done = (poster: Blob | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve(poster);
    };
    const timer = setTimeout(() => done(null), WAIT_MS);
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.onerror = () => done(null);
    video.onloadeddata = () => {
      video.currentTime = Math.min(0.5, (video.duration || 1) / 2);
    };
    video.onseeked = () => {
      if (!video.videoWidth) return done(null);
      const scale = Math.min(1, maxSide / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext('2d')!.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(done, 'image/jpeg', 0.85);
    };
    video.src = url;
  });
}
