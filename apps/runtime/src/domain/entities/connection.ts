import { ConnectionId, UserId } from '@domain/value-objects';

export enum ConnectionStatus {
  CONNECTED = 'connected',
  AUTHENTICATED = 'authenticated',
  DISCONNECTED = 'disconnected',
  SUSPENDED = 'suspended',
}

export class Connection {
  constructor(
    private readonly id: ConnectionId,
    private readonly userId: UserId | null,
    private readonly status: ConnectionStatus,
    private readonly connectedAt: Date,
    private readonly lastActivityAt: Date = new Date(),
    private readonly ttl: number = 24 * 60 * 60, // 24 hours in seconds
    private readonly metadata: Record<string, unknown> = {}
  ) {
    this.validate();
  }

  getId(): ConnectionId {
    return this.id;
  }

  getUserId(): UserId | null {
    return this.userId;
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  getConnectedAt(): Date {
    return new Date(this.connectedAt);
  }

  getLastActivityAt(): Date {
    return new Date(this.lastActivityAt);
  }

  getTtl(): number {
    return this.ttl;
  }

  getMetadata(): Record<string, unknown> {
    return { ...this.metadata }; // Return a copy to prevent external modification
  }

  isAuthenticated(): boolean {
    return (
      this.status === ConnectionStatus.AUTHENTICATED && this.userId !== null
    );
  }

  isConnected(): boolean {
    return (
      this.status === ConnectionStatus.CONNECTED ||
      this.status === ConnectionStatus.AUTHENTICATED
    );
  }

  isSuspended(): boolean {
    return this.status === ConnectionStatus.SUSPENDED;
  }

  isExpired(): boolean {
    const now = new Date();
    const expirationTime = new Date(
      this.lastActivityAt.getTime() + this.ttl * 1000
    );
    return now > expirationTime;
  }

  getTimeUntilExpiration(): number {
    const now = new Date();
    const expirationTime = new Date(
      this.lastActivityAt.getTime() + this.ttl * 1000
    );
    return Math.max(0, expirationTime.getTime() - now.getTime());
  }

  authenticate(userId: UserId): Connection {
    return new Connection(
      this.id,
      userId,
      ConnectionStatus.AUTHENTICATED,
      this.connectedAt,
      new Date(),
      this.ttl,
      this.metadata
    );
  }

  updateActivity(): Connection {
    return new Connection(
      this.id,
      this.userId,
      this.status,
      this.connectedAt,
      new Date(),
      this.ttl,
      this.metadata
    );
  }

  disconnect(): Connection {
    return new Connection(
      this.id,
      this.userId,
      ConnectionStatus.DISCONNECTED,
      this.connectedAt,
      this.lastActivityAt,
      this.ttl,
      this.metadata
    );
  }

  suspend(): Connection {
    return new Connection(
      this.id,
      this.userId,
      ConnectionStatus.SUSPENDED,
      this.connectedAt,
      this.lastActivityAt,
      this.ttl,
      this.metadata
    );
  }

  reconnect(): Connection {
    return new Connection(
      this.id,
      this.userId,
      ConnectionStatus.CONNECTED,
      this.connectedAt,
      new Date(),
      this.ttl,
      this.metadata
    );
  }

  extendTtl(additionalSeconds: number): Connection {
    return new Connection(
      this.id,
      this.userId,
      this.status,
      this.connectedAt,
      this.lastActivityAt,
      this.ttl + additionalSeconds,
      this.metadata
    );
  }

  addMetadata(key: string, value: unknown): Connection {
    const newMetadata = { ...this.metadata, [key]: value };
    return new Connection(
      this.id,
      this.userId,
      this.status,
      this.connectedAt,
      this.lastActivityAt,
      this.ttl,
      newMetadata
    );
  }

  removeMetadata(key: string): Connection {
    const newMetadata = { ...this.metadata };
    delete newMetadata[key];
    return new Connection(
      this.id,
      this.userId,
      this.status,
      this.connectedAt,
      this.lastActivityAt,
      this.ttl,
      newMetadata
    );
  }

  private validate(): void {
    if (!this.id) {
      throw new Error('Connection ID is required');
    }

    if (this.connectedAt > new Date()) {
      throw new Error('Connected date cannot be in the future');
    }

    if (this.lastActivityAt > new Date()) {
      throw new Error('Last activity date cannot be in the future');
    }

    if (this.ttl <= 0) {
      throw new Error('TTL must be positive');
    }

    if (this.ttl > 7 * 24 * 60 * 60) {
      // 7 days max
      throw new Error('TTL cannot exceed 7 days');
    }

    if (!Object.values(ConnectionStatus).includes(this.status)) {
      throw new Error('Invalid connection status');
    }
  }

  static create(connectionId: string): Connection {
    return new Connection(
      ConnectionId.create(connectionId),
      null,
      ConnectionStatus.CONNECTED,
      new Date()
    );
  }

  static fromData(data: {
    id: string;
    userId?: string;
    status: ConnectionStatus;
    connectedAt: Date;
    lastActivityAt?: Date;
    ttl?: number;
    metadata?: Record<string, unknown>;
  }): Connection {
    return new Connection(
      ConnectionId.create(data.id),
      data.userId ? UserId.create(data.userId) : null,
      data.status,
      data.connectedAt,
      data.lastActivityAt || new Date(),
      data.ttl || 24 * 60 * 60,
      data.metadata || {}
    );
  }
}
