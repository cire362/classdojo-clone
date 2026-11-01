import { useEffect, useRef, useState } from 'react';
import { MUSIC_KEY, defaultMusic, restoreMusic, type MusicSettings } from '../music';
import { startMusic, type MusicPlayer } from '../music-player';

/** Браузер разрешает звук только после действия пользователя, поэтому после перезагрузки музыка не продолжается сама. */
export function useLessonMusic() {
  const [settings, setSettings] = useState<MusicSettings>(() => {
    try { return restoreMusic(localStorage.getItem(MUSIC_KEY)); }
    catch { return defaultMusic(); }
  });
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const player = useRef<MusicPlayer | null>(null);
  const request = useRef(0);

  useEffect(() => {
    try { localStorage.setItem(MUSIC_KEY, JSON.stringify(settings)); }
    catch { /* Без хранилища настройки живут до закрытия страницы. */ }
  }, [settings]);

  // Музыка не должна играть дальше, когда экран урока закрыт
  useEffect(() => () => { request.current++; player.current?.stop(); }, []);

  async function play(next: MusicSettings) {
    const current = ++request.current;
    player.current?.stop();
    player.current = null;
    try {
      const started = await startMusic(next.trackId, next.volume);
      if (current !== request.current) { started.stop(); return; }
      player.current = started;
      setError('');
      setPlaying(true);
    } catch {
      if (current === request.current) {
        setPlaying(false);
        setError('Звук недоступен. Урок можно продолжать без музыки.');
      }
    }
  }
  function stop() {
    request.current++;
    player.current?.stop();
    player.current = null;
    setPlaying(false);
  }
  function chooseTrack(trackId: MusicSettings['trackId']) {
    const next = { ...settings, trackId };
    setSettings(next);
    if (playing) void play(next);
  }
  function changeVolume(volume: number) {
    setSettings({ ...settings, volume });
    player.current?.setVolume(volume);
  }

  return { settings, playing, error, play: () => play(settings), stop, chooseTrack, changeVolume };
}
