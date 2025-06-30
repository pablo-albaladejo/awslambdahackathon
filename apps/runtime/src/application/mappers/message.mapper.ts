import { Message, MessageType } from '@domain/entities/message';
import { SessionId } from '@domain/value-objects/session-id';
import { UserId } from '@domain/value-objects/user-id';

import {
  CreateMessageDto,
  MessageDto,
  UpdateMessageDto,
} from '../dto/domain/message.dto';

import { BidirectionalMapper } from '@/shared/mappers/mapper.interface';

/**
 * Bidirectional mapper for Message entity and MessageDto
 */
export class MessageMapper implements BidirectionalMapper<Message, MessageDto> {
  /**
   * Maps DTO to domain entity
   */
  mapToDomain(dto: MessageDto): Message {
    return Message.fromData({
      id: dto.id,
      userId: dto.userId,
      content: dto.content,
      type: dto.type,
      status: dto.status,
      createdAt: new Date(dto.createdAt),
      sessionId: crypto.randomUUID(), // Default session ID - should be provided in real usage
      metadata: dto.metadata,
    });
  }

  /**
   * Maps domain entity to DTO
   */
  mapToDto(entity: Message): MessageDto {
    return {
      id: entity.getId().getValue(),
      userId: entity.getUserId().getValue(),
      content: entity.getContent(),
      type: entity.getType(),
      status: entity.getStatus(),
      createdAt: entity.getCreatedAt().toISOString(),
      updatedAt: entity.getCreatedAt().toISOString(), // Message doesn't have updatedAt, using createdAt
      metadata: entity.getMetadata(),
    };
  }

  /**
   * Maps array of DTOs to domain entities
   */
  mapArrayToDomain(dtos: MessageDto[]): Message[] {
    return dtos.map(dto => this.mapToDomain(dto));
  }

  /**
   * Maps array of domain entities to DTOs
   */
  mapArrayToDto(entities: Message[]): MessageDto[] {
    return entities.map(entity => this.mapToDto(entity));
  }

  /**
   * Maps CreateMessageDto to Message entity
   */
  fromCreateDto(dto: CreateMessageDto): Message {
    const messageType = dto.type || MessageType.USER;
    const userId = UserId.create(dto.userId);
    const sessionId = SessionId.generate(); // Generate a new session ID

    switch (messageType) {
      case MessageType.USER:
        return Message.createUserMessage(dto.content, userId, sessionId);
      case MessageType.BOT:
        return Message.createBotMessage(dto.content, userId, sessionId);
      case MessageType.SYSTEM:
        return Message.createSystemMessage(dto.content, userId, sessionId);
      case MessageType.ADMIN:
        return Message.createAdminMessage(dto.content, userId, sessionId);
      default:
        return Message.createUserMessage(dto.content, userId, sessionId);
    }
  }

  /**
   * Updates a Message entity with data from UpdateMessageDto
   */
  updateFromDto(entity: Message, dto: UpdateMessageDto): Message {
    let updatedMessage = entity;

    if (dto.status !== undefined) {
      switch (dto.status) {
        case 'delivered':
          updatedMessage = updatedMessage.markAsDelivered();
          break;
        case 'read':
          updatedMessage = updatedMessage.markAsRead();
          break;
        case 'failed':
          updatedMessage = updatedMessage.markAsFailed();
          break;
      }
    }

    if (dto.metadata !== undefined) {
      // Add each metadata property
      Object.entries(dto.metadata).forEach(([key, value]) => {
        updatedMessage = updatedMessage.addMetadata(key, value);
      });
    }

    return updatedMessage;
  }
}
