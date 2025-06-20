class SoundService {
  private audioContext: AudioContext | null = null;
  private isEnabled: boolean = true;

  constructor() {
    // Initialize audio context when first needed
    this.initAudioContext();
  }

  private initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.warn('Web Audio API not supported:', error);
      this.isEnabled = false;
    }
  }

  private async ensureAudioContext() {
    if (!this.audioContext) {
      this.initAudioContext();
    }

    // Resume audio context if it's suspended (required by browser policies)
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch (error) {
        console.warn('Could not resume audio context:', error);
      }
    }
  }

  private playTone(frequency: number, duration: number, volume: number = 0.1, type: OscillatorType = 'sine') {
    if (!this.isEnabled || !this.audioContext) return;

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
      oscillator.type = type;

      // Envelope for smooth attack and decay
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + duration);
    } catch (error) {
      console.warn('Error playing tone:', error);
    }
  }

  private async playChord(frequencies: number[], duration: number, volume: number = 0.05) {
    if (!this.isEnabled || !this.audioContext) return;

    await this.ensureAudioContext();

    frequencies.forEach(freq => {
      this.playTone(freq, duration, volume);
    });
  }

  // Green - New ticket assigned or resolved (pleasant, soft)
  async playNewTicketSound() {
    await this.ensureAudioContext();
    // Pleasant major chord progression
    setTimeout(() => this.playTone(523.25, 0.2, 0.08, 'sine'), 0);   // C5
    setTimeout(() => this.playTone(659.25, 0.2, 0.06, 'sine'), 100); // E5
    setTimeout(() => this.playTone(783.99, 0.3, 0.05, 'sine'), 200); // G5
  }

  // Yellow - Ticket needs attention (moderate urgency)
  async playYellowTicketSound() {
    await this.ensureAudioContext();
    // Neutral tone with slight tension
    setTimeout(() => this.playTone(440.00, 0.15, 0.1, 'triangle'), 0);   // A4
    setTimeout(() => this.playTone(554.37, 0.15, 0.08, 'triangle'), 150); // C#5
    setTimeout(() => this.playTone(659.25, 0.2, 0.06, 'triangle'), 300);  // E5
  }

  // Red - Urgent ticket (dramatic, attention-grabbing)
  async playRedTicketSound() {
    await this.ensureAudioContext();
    // Dramatic minor chord with dissonance
    setTimeout(() => this.playTone(349.23, 0.2, 0.12, 'sawtooth'), 0);   // F4
    setTimeout(() => this.playTone(415.30, 0.2, 0.10, 'sawtooth'), 100); // G#4
    setTimeout(() => this.playTone(523.25, 0.3, 0.08, 'sawtooth'), 200); // C5
    setTimeout(() => this.playTone(622.25, 0.4, 0.06, 'sawtooth'), 300); // D#5
  }

  // Special sound for ticket status changes
  async playTicketUpdateSound() {
    await this.ensureAudioContext();
    // Quick notification beep
    this.playTone(800, 0.1, 0.06, 'sine');
    setTimeout(() => this.playTone(1000, 0.1, 0.04, 'sine'), 120);
  }

  // Enable/disable sounds
  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  isAudioEnabled(): boolean {
    return this.isEnabled && !!this.audioContext;
  }

  // Test all sounds
  async testAllSounds() {
    console.log('Testing new ticket sound...');
    await this.playNewTicketSound();
    
    setTimeout(async () => {
      console.log('Testing yellow ticket sound...');
      await this.playYellowTicketSound();
    }, 1000);
    
    setTimeout(async () => {
      console.log('Testing red ticket sound...');
      await this.playRedTicketSound();
    }, 2000);
    
    setTimeout(async () => {
      console.log('Testing update sound...');
      await this.playTicketUpdateSound();
    }, 3000);
  }
}

export default new SoundService(); 