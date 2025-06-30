import { UserGroup } from '@domain/entities/user';

/**
 * DTO for User entity
 */
export interface UserDto {
  /** User ID */
  id: string;

  /** Username */
  username: string;

  /** Email address */
  email: string;

  /** User groups/roles */
  groups: UserGroup[];

  /** Whether the user is active */
  isActive: boolean;

  /** Creation timestamp */
  createdAt: string;

  /** Last activity timestamp */
  lastActivityAt: string;
}

/**
 * Partial DTO for User updates
 */
export interface UserUpdateDto {
  /** Username (optional for updates) */
  username?: string;

  /** Email address (optional for updates) */
  email?: string;

  /** User groups/roles (optional for updates) */
  groups?: UserGroup[];

  /** Whether the user is active (optional for updates) */
  isActive?: boolean;

  /** Last activity timestamp (optional for updates) */
  lastActivityAt?: string;
}

/**
 * DTO for User creation
 */
export interface CreateUserDto {
  /** User ID (optional, will be generated if not provided) */
  id?: string;

  /** Username */
  username: string;

  /** Email address */
  email: string;

  /** User groups/roles (defaults to ['user']) */
  groups?: UserGroup[];

  /** Whether the user is active (defaults to true) */
  isActive?: boolean;
}
