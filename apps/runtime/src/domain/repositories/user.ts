import { User } from '@domain/entities';
import { ConnectionId, UserId } from '@domain/value-objects';

export interface UserRepository {
  findById(id: UserId): Promise<User | null>;
  findByConnectionId(connectionId: ConnectionId): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<void>;
  delete(id: UserId): Promise<void>;
  exists(id: UserId): Promise<boolean>;
  findByGroup(group: string): Promise<User[]>;
  updateLastActivity(id: UserId): Promise<void>;
}
