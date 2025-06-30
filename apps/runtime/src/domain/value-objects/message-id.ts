export class MessageId {
  constructor(private readonly value: string) {
    if (!this.isValid(value)) {
      throw new Error('Invalid MessageId: must be a non-empty string');
    }
  }

  getValue(): string {
    return this.value;
  }

  equals(other: MessageId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }

  private isValid(value: string): boolean {
    return typeof value === 'string' && value.trim().length > 0;
  }

  static create(value: string): MessageId {
    return new MessageId(value);
  }

  static generate(): MessageId {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return new MessageId(`msg_${timestamp}_${random}`);
  }
}
