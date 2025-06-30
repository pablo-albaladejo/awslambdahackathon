export class SessionId {
  constructor(private readonly value: string) {
    if (!this.isValid(value)) {
      throw new Error('Invalid SessionId: must be a non-empty string');
    }
  }

  getValue(): string {
    return this.value;
  }

  equals(other: SessionId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }

  private isValid(value: string): boolean {
    return typeof value === 'string' && value.trim().length > 0;
  }

  static create(value: string): SessionId {
    return new SessionId(value);
  }

  static generate(): SessionId {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return new SessionId(`session_${timestamp}_${random}`);
  }
}
