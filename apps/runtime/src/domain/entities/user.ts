import { DomainError } from '@domain/errors/domain-errors';
import {
  UserData,
  UserValidator,
} from '@domain/validation/validators/user-validator';
import { UserId } from '@domain/value-objects/user-id';

export type UserGroup = 'admin' | 'user' | 'guest' | 'moderator' | 'banned';

export interface UserProps {
  id: UserId;
  username: string;
  email: string;
  groups: UserGroup[];
  createdAt: Date;
  lastActivityAt: Date;
  isActive: boolean;
}

export interface UserJSON {
  id: string;
  username: string;
  email: string;
  groups: UserGroup[];
  createdAt: Date;
  lastActivityAt: Date;
  isActive: boolean;
}

export class User {
  private readonly id: UserId;
  private readonly username: string;
  private readonly email: string;
  private readonly groups: UserGroup[];
  private readonly createdAt: Date;
  private lastActivityAt: Date;
  private active: boolean;

  constructor(props: UserProps) {
    this.validateGroups(props.groups);
    this.validateEmail(props.email);
    this.validateUsername(props.username);
    this.validateLastActivityDate(props.lastActivityAt, props.createdAt);

    this.id = props.id;
    this.username = props.username;
    this.email = props.email;
    this.groups = props.groups;
    this.createdAt = props.createdAt;
    this.lastActivityAt = props.lastActivityAt;
    this.active = props.isActive;
  }

  private validateGroups(groups: UserGroup[]): void {
    if (!groups || groups.length === 0) {
      throw new DomainError(
        'User must belong to at least one group',
        'VALIDATION_ERROR',
        { groups }
      );
    }
  }

  private validateEmail(email: string): void {
    if (!email || !email.includes('@')) {
      throw new DomainError(
        'User must have a valid email address',
        'VALIDATION_ERROR',
        { email }
      );
    }
  }

  private validateUsername(username: string): void {
    if (!username || username.length < 3) {
      throw new DomainError(
        'Username must be at least 3 characters long',
        'VALIDATION_ERROR',
        { username }
      );
    }
  }

  private validateLastActivityDate(
    lastActivityAt: Date,
    createdAt: Date
  ): void {
    if (lastActivityAt < createdAt) {
      throw new DomainError(
        'Last activity date cannot be before creation date',
        'VALIDATION_ERROR',
        { lastActivityAt }
      );
    }
  }

  public getId(): UserId {
    return this.id;
  }

  public getUserId(): string {
    return this.id.getValue();
  }

  public getUsername(): string {
    return this.username;
  }

  public getEmail(): string {
    return this.email;
  }

  public getGroups(): UserGroup[] {
    return [...this.groups];
  }

  public getCreatedAt(): Date {
    return new Date(this.createdAt);
  }

  public getLastActivityAt(): Date {
    return new Date(this.lastActivityAt);
  }

  public isActive(): boolean {
    return this.active;
  }

  public hasGroup(group: UserGroup): boolean {
    return this.groups.includes(group);
  }

  public hasAnyGroup(requiredGroups: UserGroup[]): boolean {
    return requiredGroups.some(group => this.hasGroup(group));
  }

  public hasAllGroups(requiredGroups: UserGroup[]): boolean {
    return requiredGroups.every(group => this.hasGroup(group));
  }

  public canSendMessage(): boolean {
    // Business rule: user must be active, authenticated and not banned
    return this.isActive() && !this.isBanned() && this.isRecentlyActive();
  }

  public canAccessAdminFeatures(): boolean {
    return this.hasGroup('admin') || this.hasGroup('moderator');
  }

  public canManageUsers(): boolean {
    return this.hasGroup('admin');
  }

  public canModerateContent(): boolean {
    return this.hasGroup('admin') || this.hasGroup('moderator');
  }

  public updateLastActivity(date: Date): void {
    this.validateLastActivityDate(date, this.createdAt);
    this.lastActivityAt = date;
  }

  public deactivate(): void {
    this.active = false;
  }

  public activate(): void {
    this.active = true;
  }

  public addGroup(group: UserGroup): User {
    if (this.hasGroup(group)) {
      return this; // No change needed
    }

    const newGroups = [...this.groups, group];
    return new User({
      id: this.id,
      username: this.username,
      email: this.email,
      groups: newGroups,
      createdAt: this.createdAt,
      lastActivityAt: this.lastActivityAt,
      isActive: this.active,
    });
  }

  public removeGroup(group: UserGroup): User {
    if (!this.hasGroup(group)) {
      return this; // No change needed
    }

    const newGroups = this.groups.filter(g => g !== group);
    return new User({
      id: this.id,
      username: this.username,
      email: this.email,
      groups: newGroups,
      createdAt: this.createdAt,
      lastActivityAt: this.lastActivityAt,
      isActive: this.active,
    });
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
    const userData: UserData = {
      username: this.username,
      email: this.email,
      groups: this.groups,
      createdAt: this.createdAt,
      lastActivityAt: this.lastActivityAt,
      isActive: this.active,
    };

    UserValidator.validateAndThrow(userData);
  }

  public toJSON(): UserJSON {
    return {
      id: this.id.getValue(),
      username: this.username,
      email: this.email,
      groups: this.groups,
      createdAt: this.createdAt,
      lastActivityAt: this.lastActivityAt,
      isActive: this.active,
    };
  }

  static create(
    id: string,
    username: string,
    email: string,
    groups: UserGroup[] = ['user']
  ): User {
    return new User({
      id: UserId.create(id),
      username,
      email,
      groups,
      createdAt: new Date(),
      lastActivityAt: new Date(),
      isActive: true,
    });
  }

  static fromData(data: {
    id: string;
    username: string;
    email: string;
    groups?: UserGroup[];
    createdAt?: Date;
    lastActivityAt?: Date;
    isActive?: boolean;
  }): User {
    return new User({
      id: UserId.create(data.id),
      username: data.username,
      email: data.email,
      groups: data.groups || ['user'],
      createdAt: data.createdAt || new Date(),
      lastActivityAt: data.lastActivityAt || new Date(),
      isActive: data.isActive !== undefined ? data.isActive : true,
    });
  }
}
