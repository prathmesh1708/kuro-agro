/**
 * Sound helper for playing pleasant synthesized alert chimes
 * Uses the native Web Audio API to produce high-quality audio without external asset dependencies
 * and safely handles browser autoplay permissions.
 */

let audioCtx = null;

const getAudioContext = () => {
    if (typeof window === 'undefined') return null;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!audioCtx) {
        audioCtx = new AudioContextClass();
    }

    if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
    }

    return audioCtx;
};

/**
 * Plays a pleasant modern triple-tone chime for incoming orders
 */
export const playOrderAlertSound = () => {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        const now = ctx.currentTime;

        // Tone sequence: E5 (659.25Hz), G#5 (830.61Hz), B5 (987.77Hz)
        const notes = [
            { freq: 659.25, start: now, duration: 0.15 },
            { freq: 830.61, start: now + 0.14, duration: 0.18 },
            { freq: 987.77, start: now + 0.30, duration: 0.40 },
        ];

        notes.forEach(({ freq, start, duration }) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, start);

            // Envelope: gentle attack, exponential decay
            gain.gain.setValueAtTime(0.001, start);
            gain.gain.exponentialRampToValueAtTime(0.25, start + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start(start);
            osc.stop(start + duration);
        });
    } catch (err) {
        console.warn('[SoundHelper] Autoplay blocked or AudioContext unavailable:', err);
    }
};

export default {
    playOrderAlertSound,
};
