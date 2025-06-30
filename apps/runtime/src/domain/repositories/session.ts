import { Session, SessionStatus } from '../entities';
import { SessionId, UserId } from '../value-objects';

export interface SessionRepository {
  findById(id: SessionId): Promise<Session | null>;
  findByUserId(userId: UserId): Promise<Session[]>;
  findByStatus(status: SessionStatus): Promise<Session[]>;
  save(session: Session): Promise<void>;
  delete(id: SessionId): Promise<void>;
  exists(id: SessionId): Promise<boolean>;
  updateActivity(id: SessionId): Promise<void>;
  findExpiredSessions(): Promise<Session[]>;
  deleteExpiredSessions(): Promise<void>;
  findActiveSessionByUser(userId: UserId): Promise<Session | null>;
  countByStatus(status: SessionStatus): Promise<number>;
  countByUser(userId: UserId): Promise<number>;
}
