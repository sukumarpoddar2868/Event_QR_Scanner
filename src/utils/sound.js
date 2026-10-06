let audioContext = null;

function getAudioContext() {
  if (typeof window === "undefined") {
    return null;
  }

  if (!audioContext) {
    const AudioContext =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContext) {
      return null;
    }

    audioContext = new AudioContext();
  }

  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }

  return audioContext;
}

// Enable audio after a user interaction.
export function enableScannerSound() {
  const ctx = getAudioContext();

  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
}

function playTone(
  frequency,
  duration,
  type = "sine",
  volume = 0.15
) {
  const ctx = getAudioContext();

  if (!ctx) return;

  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.type = type;

  oscillator.frequency.setValueAtTime(
    frequency,
    ctx.currentTime
  );

  gainNode.gain.setValueAtTime(
    volume,
    ctx.currentTime
  );

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
  playTone(880, 0.12, "sine", 0.2);

  setTimeout(() => {
    playTone(1200, 0.18, "sine", 0.2);
  }, 100);
}

// Already checked in
export function playWarningSound() {
  playTone(650, 0.15, "square", 0.12);

  setTimeout(() => {
    playTone(450, 0.22, "square", 0.12);
  }, 160);
}

// Invalid ticket
export function playErrorSound() {
  playTone(300, 0.35, "sawtooth", 0.15);
}
