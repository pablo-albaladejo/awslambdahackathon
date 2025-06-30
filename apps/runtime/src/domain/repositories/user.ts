import { User } from '@domain/entities/user';
import { UserId } from '@domain/value-objects';

import { Specification } from './specification';

export interface UserRepository {
  findById(id: UserId): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findBySpecification(specification: Specification<User>): Promise<User[]>;
  save(user: User): Promise<void>;
  delete(id: UserId): Promise<void>;
  exists(id: UserId): Promise<boolean>;
  findAll(): Promise<User[]>;
  update(user: User): Promise<void>;
  count(): Promise<number>;
  updateLastActivity(id: UserId): Promise<void>;
}
