let audioContext = null;

function getAudioContext() {
  if (!audioContext) {
    const AudioContext =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContext) {
      return null;
    }

    audioContext = new AudioContext();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume();
  }

  return audioContext;
}

function playTone(frequency, duration, type = "sine", volume = 0.15) {
  const ctx = getAudioContext();

  if (!ctx) return;

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.value = frequency;

  gainNode.gain.setValueAtTime(volume, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(
    0.001,
    ctx.currentTime + duration
  );

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.start();
  oscillator.stop(ctx.currentTime + duration);
}

// Valid ticket
export function playSuccessSound() {
  playTone(880, 0.15, "sine", 0.2);

  setTimeout(() => {
    playTone(1200, 0.18, "sine", 0.2);
  }, 100);
}

// Already checked-in ticket
export function playWarningSound() {
  playTone(700, 0.18, "square", 0.12);

  setTimeout(() => {
    playTone(500, 0.22, "square", 0.12);
  }, 150);
}

// Invalid ticket
export function playErrorSound() {
  playTone(300, 0.35, "sawtooth", 0.15);
}
