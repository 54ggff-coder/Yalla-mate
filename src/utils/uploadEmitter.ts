type ProgressCallback = (progress: number) => void;

class ReelUploadEventEmitter {
  private listeners: ProgressCallback[] = [];

  subscribe(callback: ProgressCallback): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  emit(progress: number) {
    this.listeners.forEach(l => l(progress));
  }
}

export const reelUploadEmitter = new ReelUploadEventEmitter();
