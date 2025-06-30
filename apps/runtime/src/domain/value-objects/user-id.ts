export class UserId {
  constructor(private readonly value: string) {
    if (!this.isValid(value)) {
      throw new Error('Invalid UserId: must be a non-empty string');
    }
  }

  getValue(): string {
    return this.value;
  }

  equals(other: UserId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }

  private isValid(value: string): boolean {
    return typeof value === 'string' && value.trim().length > 0;
  }

  static create(value: string): UserId {
    return new UserId(value);
  }
}
