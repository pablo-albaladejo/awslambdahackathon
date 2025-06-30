import { User, UserGroup } from '@domain/entities/user';
import { Specification } from '@domain/repositories/specification';

// User group constants
const USER_GROUPS = {
  ADMIN: 'admin' as UserGroup,
  USER: 'user' as UserGroup,
} as const;

export class ActiveUserSpecification implements Specification<User> {
  isSatisfiedBy(user: User): boolean {
    return user.isActive();
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

export class UserByGroupSpecification implements Specification<User> {
  constructor(private readonly group: UserGroup) {}

  isSatisfiedBy(user: User): boolean {
    return user.getGroups().includes(this.group);
  }

  toQuery(): Record<string, unknown> {
    return {
      groups: { $contains: this.group },
    };
  }
}

export class RecentlyActiveUserSpecification implements Specification<User> {
  constructor(private readonly withinDays: number = 30) {}

  isSatisfiedBy(user: User): boolean {
    const now = new Date();
    const lastActivity = user.getLastActivityAt();
    const daysSinceLastActivity = Math.floor(
      (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceLastActivity <= this.withinDays;
  }

  toQuery(): Record<string, unknown> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.withinDays);
    return {
      lastActivityAt: { $gt: cutoffDate.toISOString() },
    };
  }
}

export class UserByEmailDomainSpecification implements Specification<User> {
  constructor(private readonly domain: string) {}

  isSatisfiedBy(user: User): boolean {
    const email = user.getEmail();
    const domainPattern = `@${this.domain}`;
    return email.endsWith(domainPattern);
  }

  toQuery(): Record<string, unknown> {
    return {
      email: { $regex: `@${this.domain}$` },
    };
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
