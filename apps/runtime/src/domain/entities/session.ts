import { SessionId, UserId } from '../value-objects';

export enum SessionStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  EXPIRED = 'expired',
  SUSPENDED = 'suspended',
}

export class Session {
  constructor(
    private readonly id: SessionId,
    private readonly userId: UserId,
    private readonly status: SessionStatus,
    private readonly createdAt: Date = new Date(),
    private readonly lastActivityAt: Date = new Date(),
    private readonly expiresAt: Date,
    private readonly metadata: Record<string, unknown> = {},
    private readonly maxDurationInMinutes: number = 60
  ) {
    this.validate();
  }

  getId(): SessionId {
    return this.id;
  }

  getUserId(): UserId {
    return this.userId;
  }

  getStatus(): SessionStatus {
    return this.status;
  }

  getCreatedAt(): Date {
    return new Date(this.createdAt);
  }

  getLastActivityAt(): Date {
    return new Date(this.lastActivityAt);
  }

  getExpiresAt(): Date {
    return new Date(this.expiresAt);
  }

  getMetadata(): Record<string, unknown> {
    return { ...this.metadata }; // Return a copy to prevent external modification
  }

  getMaxDurationInMinutes(): number {
    return this.maxDurationInMinutes;
  }

  isActive(): boolean {
    return this.status === SessionStatus.ACTIVE && !this.isExpired();
  }

  isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  isSuspended(): boolean {
    return this.status === SessionStatus.SUSPENDED;
  }

  getTimeUntilExpiration(): number {
    const now = new Date();
    return Math.max(0, this.expiresAt.getTime() - now.getTime());
  }

  getTimeSinceLastActivity(): number {
    const now = new Date();
    return now.getTime() - this.lastActivityAt.getTime();
  }

  getDurationInMinutes(): number {
    const now = new Date();
    return Math.floor((now.getTime() - this.createdAt.getTime()) / (1000 * 60));
  }

  updateActivity(): Session {
    return new Session(
      this.id,
      this.userId,
      this.status,
      this.createdAt,
      new Date(),
      this.expiresAt,
      this.metadata,
      this.maxDurationInMinutes
    );
  }

  extend(durationInMinutes: number): Session {
    const newExpiresAt = new Date(
      this.expiresAt.getTime() + durationInMinutes * 60 * 1000
    );
    return new Session(
      this.id,
      this.userId,
      SessionStatus.ACTIVE,
      this.createdAt,
      new Date(),
      newExpiresAt,
      this.metadata,
      this.maxDurationInMinutes
    );
  }

  deactivate(): Session {
    return new Session(
      this.id,
      this.userId,
      SessionStatus.INACTIVE,
      this.createdAt,
      this.lastActivityAt,
      this.expiresAt,
      this.metadata,
      this.maxDurationInMinutes
    );
  }

  suspend(): Session {
    return new Session(
      this.id,
      this.userId,
      SessionStatus.SUSPENDED,
      this.createdAt,
      this.lastActivityAt,
      this.expiresAt,
      this.metadata,
      this.maxDurationInMinutes
    );
  }

  reactivate(): Session {
    return new Session(
      this.id,
      this.userId,
      SessionStatus.ACTIVE,
      this.createdAt,
      new Date(),
      this.expiresAt,
      this.metadata,
      this.maxDurationInMinutes
    );
  }

  addMetadata(key: string, value: unknown): Session {
    const newMetadata = { ...this.metadata, [key]: value };
    return new Session(
      this.id,
      this.userId,
      this.status,
      this.createdAt,
      this.lastActivityAt,
      this.expiresAt,
      newMetadata,
      this.maxDurationInMinutes
    );
  }

  removeMetadata(key: string): Session {
    const newMetadata = { ...this.metadata };
    delete newMetadata[key];
    return new Session(
      this.id,
      this.userId,
      this.status,
      this.createdAt,
      this.lastActivityAt,
      this.expiresAt,
      newMetadata,
      this.maxDurationInMinutes
    );
  }

  isInactiveForTooLong(maxInactiveMinutes: number): boolean {
    const inactiveTime = this.getTimeSinceLastActivity();
    return inactiveTime > maxInactiveMinutes * 60 * 1000;
  }

  private validate(): void {
    if (!this.id) {
      throw new Error('Session ID is required');
    }

    if (!this.userId) {
      throw new Error('User ID is required');
    }

    if (!Object.values(SessionStatus).includes(this.status)) {
      throw new Error('Invalid session status');
    }

    if (this.createdAt > new Date()) {
      throw new Error('Created date cannot be in the future');
    }

    if (this.lastActivityAt > new Date()) {
      throw new Error('Last activity date cannot be in the future');
    }

    if (this.expiresAt <= this.createdAt) {
      throw new Error('Expiration date must be after creation date');
    }

    if (this.maxDurationInMinutes <= 0) {
      throw new Error('Max duration must be positive');
    }

    if (this.maxDurationInMinutes > 24 * 60) {
      // 24 hours max
      throw new Error('Max duration cannot exceed 24 hours');
    }
  }

  static create(
    userId: UserId,
    durationInMinutes: number = 60,
    maxDurationInMinutes: number = 60
  ): Session {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationInMinutes * 60 * 1000);

    return new Session(
      SessionId.generate(),
      userId,
      SessionStatus.ACTIVE,
      now,
      now,
      expiresAt,
      {},
      maxDurationInMinutes
    );
  }

  static fromData(data: {
    id: string;
    userId: string;
    status: SessionStatus;
    createdAt?: Date;
    lastActivityAt?: Date;
    expiresAt: Date;
    metadata?: Record<string, unknown>;
    maxDurationInMinutes?: number;
  }): Session {
    return new Session(
      SessionId.create(data.id),
      UserId.create(data.userId),
      data.status,
      data.createdAt || new Date(),
      data.lastActivityAt || new Date(),
      data.expiresAt,
      data.metadata || {},
      data.maxDurationInMinutes || 60
    );
  }
}
