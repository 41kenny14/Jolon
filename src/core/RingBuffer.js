export class RingBuffer {
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error('capacity must be a positive integer');
    }
    this.capacity = capacity;
    this.buffer = new Array(capacity);
    this.start = 0;
    this.size = 0;
  }

  push(item) {
    const end = (this.start + this.size) % this.capacity;
    this.buffer[end] = item;

    if (this.size < this.capacity) {
      this.size += 1;
    } else {
      this.start = (this.start + 1) % this.capacity;
    }
  }

  get(indexFromEnd = 0) {
    if (indexFromEnd < 0 || indexFromEnd >= this.size) return null;
    const idx = (this.start + this.size - 1 - indexFromEnd + this.capacity) % this.capacity;
    return this.buffer[idx];
  }

  toArray() {
    const out = new Array(this.size);
    for (let i = 0; i < this.size; i += 1) {
      out[i] = this.buffer[(this.start + i) % this.capacity];
    }
    return out;
  }
}
