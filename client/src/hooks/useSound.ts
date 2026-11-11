import { useCallback, useRef } from 'react';

/**
 * Hook per gestire gli effetti sonori del gioco
 * Utilizza Web Audio API per suoni sintetizzati
 */
export const useSound = () => {
  const audioContextRef = useRef<AudioContext | null>(null);

  // Inizializza AudioContext solo quando necessario
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  /**
   * Suono per risposta corretta
   * Sequenza di note ascendenti (do-mi-sol) per feedback positivo
   */
  const playCorrect = useCallback(() => {
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      // Prima nota (do - 523.25 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.frequency.value = 523.25;
      osc1.type = 'sine';
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc1.start(now);
      osc1.stop(now + 0.1);

      // Seconda nota (mi - 659.25 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.value = 659.25;
      osc2.type = 'sine';
      gain2.gain.setValueAtTime(0.3, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.18);

      // Terza nota (sol - 783.99 Hz)
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.frequency.value = 783.99;
      osc3.type = 'sine';
      gain3.gain.setValueAtTime(0.3, now + 0.16);
      gain3.gain.exponentialRampToValueAtTime(0.01, now + 0.36);
      osc3.start(now + 0.16);
      osc3.stop(now + 0.36);
    } catch (error) {
      console.warn('Errore riproduzione suono corretto:', error);
    }
  }, [getAudioContext]);

  /**
   * Suono per risposta sbagliata
   * Nota bassa discendente per feedback negativo
   */
  const playWrong = useCallback(() => {
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      // Nota discendente (da 300 Hz a 150 Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.3);
      osc.type = 'sawtooth';
      
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      
      osc.start(now);
      osc.stop(now + 0.3);
    } catch (error) {
      console.warn('Errore riproduzione suono sbagliato:', error);
    }
  }, [getAudioContext]);

  /**
   * Suono per vittoria/completamento livello
   * Sequenza più lunga e festosa
   */
  const playVictory = useCallback(() => {
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      const notes = [523.25, 659.25, 783.99, 1046.50]; // do-mi-sol-do alto
      notes.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        
        const startTime = now + (index * 0.1);
        gain.gain.setValueAtTime(0.25, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);
        osc.start(startTime);
        osc.stop(startTime + 0.15);
      });
    } catch (error) {
      console.warn('Errore riproduzione suono vittoria:', error);
    }
  }, [getAudioContext]);

  return {
    playCorrect,
    playWrong,
    playVictory
  };
};
