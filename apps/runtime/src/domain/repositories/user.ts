import { User } from '@domain/entities/user';
import { ConnectionId } from '@domain/value-objects';
import { UserId } from '@domain/value-objects/user-id';

import { Specification } from './specification';

export interface UserRepository {
  findById(id: UserId | string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByConnectionId(connectionId: ConnectionId | string): Promise<User | null>;
  findBySpecification(specification: Specification<User>): Promise<User[]>;
  save(user: User): Promise<void>;
  updateLastActivity(userId: UserId | string): Promise<void>;
  delete(userId: UserId | string): Promise<void>;
}
