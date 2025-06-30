import { Connection, ConnectionStatus } from '@domain/entities/connection';

import {
  ConnectionDto,
  CreateConnectionDto,
  UpdateConnectionDto,
} from '../dto/domain/connection.dto';

import { BidirectionalMapper } from '@/shared/mappers/mapper.interface';

/**
 * Bidirectional mapper for Connection entity and ConnectionDto
 */
export class ConnectionMapper
  implements BidirectionalMapper<Connection, ConnectionDto>
{
  /**
   * Maps DTO to domain entity
   */
  mapToDomain(dto: ConnectionDto): Connection {
    return Connection.fromData({
      id: dto.id,
      userId: dto.userId,
      sessionId: dto.sessionId,
      status: dto.isActive
        ? ConnectionStatus.AUTHENTICATED
        : ConnectionStatus.DISCONNECTED,
      connectedAt: new Date(dto.connectedAt),
      lastActivityAt: new Date(dto.lastActivityAt),
      metadata: dto.metadata,
    });
  }

  /**
   * Maps domain entity to DTO
   */
  mapToDto(entity: Connection): ConnectionDto {
    return {
      id: entity.getId().getValue(),
      userId: entity.getUserId()?.getValue() || '',
      sessionId: entity.getSessionId()?.getValue(),
      connectedAt: entity.getConnectedAt().toISOString(),
      lastActivityAt: entity.getLastActivityAt().toISOString(),
      isActive: entity.isConnected(),
      metadata: entity.getMetadata(),
    };
  }

  /**
   * Maps array of DTOs to domain entities
   */
  mapArrayToDomain(dtos: ConnectionDto[]): Connection[] {
    return dtos.map(dto => this.mapToDomain(dto));
  }

  /**
   * Maps array of domain entities to DTOs
   */
  mapArrayToDto(entities: Connection[]): ConnectionDto[] {
    return entities.map(entity => this.mapToDto(entity));
  }

  /**
   * Maps CreateConnectionDto to Connection entity
   */
  fromCreateDto(dto: CreateConnectionDto): Connection {
    return Connection.create(dto.id, dto.sessionId);
  }

  /**
   * Updates a Connection entity with data from UpdateConnectionDto
   */
  updateFromDto(entity: Connection, dto: UpdateConnectionDto): Connection {
    let updatedConnection = entity;

    if (dto.lastActivityAt !== undefined) {
      updatedConnection = updatedConnection.updateActivity();
    }

    if (dto.isActive !== undefined) {
      if (dto.isActive) {
        updatedConnection = updatedConnection.reconnect();
      } else {
        updatedConnection = updatedConnection.disconnect();
      }
    }

    if (dto.metadata !== undefined) {
      // Add each metadata property
      Object.entries(dto.metadata).forEach(([key, value]) => {
        updatedConnection = updatedConnection.addMetadata(key, value);
      });
    }

    return updatedConnection;
  }
}
