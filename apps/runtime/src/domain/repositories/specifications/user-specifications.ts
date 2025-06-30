import { User, UserGroup } from '@domain/entities/user';

import { Specification } from '../specification';

// User group constants
const USER_GROUPS = {
  ADMIN: 'admin' as UserGroup,
  USER: 'user' as UserGroup,
} as const;

/**
 * User By Group Specification
 * Finds users that belong to a specific group
 */
export class UserByGroupSpecification implements Specification<User> {
  constructor(private readonly group: UserGroup) {}

  isSatisfiedBy(user: User): boolean {
    return user.hasGroup(this.group);
  }

  toQuery(): Record<string, unknown> {
    return {
      groups: { $in: [this.group] },
    };
  }
}

/**
 * Active Users Specification
 * Finds users that are currently active
 */
export class ActiveUsersSpecification implements Specification<User> {
  isSatisfiedBy(user: User): boolean {
    return user.isActive();
  }

  toQuery(): Record<string, unknown> {
    return {
      isActive: true,
    };
  }
}

/**
 * Users Created After Date Specification
 * Finds users created after a specific date
 */
export class UsersCreatedAfterSpecification implements Specification<User> {
  constructor(private readonly date: Date) {}

  isSatisfiedBy(user: User): boolean {
    return user.getCreatedAt() > this.date;
  }

  toQuery(): Record<string, unknown> {
    return {
      createdAt: { $gt: this.date },
    };
  }
}

/**
 * Recently Active Users Specification
 * Finds users who have been active within a certain time period
 */
export class RecentlyActiveUsersSpecification implements Specification<User> {
  constructor(private readonly hours: number = 24) {}

  isSatisfiedBy(user: User): boolean {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - this.hours);

    return user.getLastActivityAt() > cutoffTime;
  }

  toQuery(): Record<string, unknown> {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - this.hours);

    return {
      lastActivityAt: { $gt: cutoffTime },
    };
  }
}

/**
 * Admin Users Specification
 * Finds users with admin privileges
 */
export class AdminUsersSpecification implements Specification<User> {
  isSatisfiedBy(user: User): boolean {
    return user.hasGroup('admin');
  }

  toQuery(): Record<string, unknown> {
    return {
      groups: { $in: ['admin'] },
    };
  }
}

/**
 * Username Pattern Specification
 * Finds users with usernames matching a pattern
 */
export class UsernamePatternSpecification implements Specification<User> {
  constructor(private readonly pattern: string) {}

  isSatisfiedBy(user: User): boolean {
    const regex = new RegExp(this.pattern, 'i');
    return regex.test(user.getUsername());
  }

  toQuery(): Record<string, unknown> {
    return {
      username: { $regex: this.pattern, $options: 'i' },
    };
  }
}

export class InactiveUserSpecification implements Specification<User> {
  isSatisfiedBy(user: User): boolean {
    return !user.isActive();
  }
}

export class AdminUserSpecification implements Specification<User> {
  isSatisfiedBy(user: User): boolean {
    return user.hasGroup(USER_GROUPS.ADMIN);
  }
}

export class ModeratorUserSpecification implements Specification<User> {
  isSatisfiedBy(user: User): boolean {
    return user.hasGroup(USER_GROUPS.USER);
  }
}

export class UserInGroupSpecification implements Specification<User> {
  constructor(private readonly group: UserGroup) {}

  isSatisfiedBy(user: User): boolean {
    return user.hasGroup(this.group);
  }
}

export class UserInAnyGroupSpecification implements Specification<User> {
  constructor(private readonly groups: UserGroup[]) {}

  isSatisfiedBy(user: User): boolean {
    return user.hasAnyGroup(this.groups);
  }
}

export class UserInAllGroupsSpecification implements Specification<User> {
  constructor(private readonly groups: UserGroup[]) {}

  isSatisfiedBy(user: User): boolean {
    return user.hasAllGroups(this.groups);
  }
}

export class IsAdminSpecification implements Specification<User> {
  isSatisfiedBy(user: User): boolean {
    return user.hasGroup(USER_GROUPS.ADMIN);
  }
}

export class IsActiveUserSpecification implements Specification<User> {
  isSatisfiedBy(user: User): boolean {
    return user.hasGroup(USER_GROUPS.USER);
  }
}
