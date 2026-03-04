import { useCallback, useEffect, useRef, useState } from 'react';
import volumeImg from '../../../assets/volume.svg';
import Button from './Button';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { useI18n } from '../../i18n';

export default function MusicButton() {
  const { t } = useI18n();
  const musicUrl = useQuery(api.music.getBackgroundMusic);
  const [isPlaying, setPlaying] = useState(false);
  const loadedUrlRef = useRef<string | null>(null);
  const soundRef = useRef<(typeof import('@pixi/sound'))['sound'] | null>(null);

  useEffect(() => {
    if (!musicUrl || !soundRef.current || loadedUrlRef.current === musicUrl) {
      return;
    }
    if (soundRef.current.exists('background')) {
      soundRef.current.remove('background');
    }
    soundRef.current.add('background', musicUrl).loop = true;
    loadedUrlRef.current = musicUrl;
  }, [musicUrl]);

  const ensureBackgroundSound = useCallback(async () => {
    if (!musicUrl) {
      return null;
    }
    if (!soundRef.current) {
      const { sound } = await import('@pixi/sound');
      soundRef.current = sound;
    }
    if (loadedUrlRef.current !== musicUrl) {
      if (soundRef.current.exists('background')) {
        soundRef.current.remove('background');
      }
      soundRef.current.add('background', musicUrl).loop = true;
      loadedUrlRef.current = musicUrl;
    }
    return soundRef.current;
  }, [musicUrl]);

  const flipSwitch = useCallback(async () => {
    const sound = await ensureBackgroundSound();
    if (!sound) {
      return;
    }
    if (isPlaying) {
      sound.stop('background');
    } else {
      await sound.play('background');
    }
    setPlaying(!isPlaying);
  }, [ensureBackgroundSound, isPlaying]);

  const handleKeyPress = useCallback(
    (event: { key: string }) => {
      if (event.key === 'm' || event.key === 'M') {
        void flipSwitch();
      }
    },
    [flipSwitch],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  return (
    <>
      <Button
        onClick={() => void flipSwitch()}
        className="hidden lg:block"
        title={t('music_title')}
        imgUrl={volumeImg}
      >
        {isPlaying ? t('mute') : t('music')}
      </Button>
    </>
  );
}
