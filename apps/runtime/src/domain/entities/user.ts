import { UserId } from '../value-objects';

export class User {
  constructor(
    private readonly id: UserId,
    private readonly username: string,
    private readonly email: string,
    private readonly groups: string[],
    private readonly createdAt: Date = new Date(),
    private readonly lastActivityAt: Date = new Date(),
    private readonly isActive: boolean = true
  ) {
    this.validate();
  }

  getId(): UserId {
    return this.id;
  }

  getUserId(): string {
    return this.id.getValue();
  }

  getUsername(): string {
    return this.username;
  }

  getEmail(): string {
    return this.email;
  }

  getGroups(): string[] {
    return [...this.groups]; // Return a copy to prevent external modification
  }

  getCreatedAt(): Date {
    return new Date(this.createdAt); // Return a copy to prevent external modification
  }

  getLastActivityAt(): Date {
    return new Date(this.lastActivityAt);
  }

  isUserActive(): boolean {
    return this.isActive;
  }

  hasGroup(group: string): boolean {
    return this.groups.includes(group);
  }

  hasAnyGroup(requiredGroups: string[]): boolean {
    return requiredGroups.some(group => this.hasGroup(group));
  }

  hasAllGroups(requiredGroups: string[]): boolean {
    return requiredGroups.every(group => this.hasGroup(group));
  }

  canSendMessage(): boolean {
    // Business rule: user must be active, authenticated and not banned
    return this.isUserActive() && !this.isBanned() && this.isRecentlyActive();
  }

  canAccessAdminFeatures(): boolean {
    return this.hasGroup('admin') || this.hasGroup('moderator');
  }

  canManageUsers(): boolean {
    return this.hasGroup('admin');
  }

  canModerateContent(): boolean {
    return this.hasGroup('admin') || this.hasGroup('moderator');
  }

  updateActivity(): User {
    return new User(
      this.id,
      this.username,
      this.email,
      this.groups,
      this.createdAt,
      new Date(),
      this.isActive
    );
  }

  deactivate(): User {
    return new User(
      this.id,
      this.username,
      this.email,
      this.groups,
      this.createdAt,
      this.lastActivityAt,
      false
    );
  }

  activate(): User {
    return new User(
      this.id,
      this.username,
      this.email,
      this.groups,
      this.createdAt,
      this.lastActivityAt,
      true
    );
  }

  addGroup(group: string): User {
    if (this.hasGroup(group)) {
      return this; // No change needed
    }

    const newGroups = [...this.groups, group];
    return new User(
      this.id,
      this.username,
      this.email,
      newGroups,
      this.createdAt,
      this.lastActivityAt,
      this.isActive
    );
  }

  removeGroup(group: string): User {
    if (!this.hasGroup(group)) {
      return this; // No change needed
    }

    const newGroups = this.groups.filter(g => g !== group);
    return new User(
      this.id,
      this.username,
      this.email,
      newGroups,
      this.createdAt,
      this.lastActivityAt,
      this.isActive
    );
  }

  private isBanned(): boolean {
    return this.hasGroup('banned');
  }

  private isRecentlyActive(): boolean {
    // Business rule: user is recently active if last activity was within last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return this.lastActivityAt > thirtyDaysAgo;
  }

  private validate(): void {
    if (!this.username || this.username.trim().length === 0) {
      throw new Error('Username cannot be empty');
    }

    if (this.username.length < 3) {
      throw new Error('Username must be at least 3 characters long');
    }

    if (this.username.length > 50) {
      throw new Error('Username cannot exceed 50 characters');
    }

    if (!this.email || this.email.trim().length === 0) {
      throw new Error('Email cannot be empty');
    }

    if (!this.isValidEmail(this.email)) {
      throw new Error('Invalid email format');
    }

    if (!Array.isArray(this.groups)) {
      throw new Error('Groups must be an array');
    }

    if (this.createdAt > new Date()) {
      throw new Error('Created date cannot be in the future');
    }

    if (this.lastActivityAt > new Date()) {
      throw new Error('Last activity date cannot be in the future');
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static create(
    id: string,
    username: string,
    email: string,
    groups: string[] = []
  ): User {
    return new User(UserId.create(id), username, email, groups);
  }

  static fromData(data: {
    id: string;
    username: string;
    email: string;
    groups?: string[];
    createdAt?: Date;
    lastActivityAt?: Date;
    isActive?: boolean;
  }): User {
    return new User(
      UserId.create(data.id),
      data.username,
      data.email,
      data.groups || [],
      data.createdAt || new Date(),
      data.lastActivityAt || new Date(),
      data.isActive !== undefined ? data.isActive : true
    );
  }
}
