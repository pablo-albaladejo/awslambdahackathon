import { Message, MessageType } from '../../domain/entities/message';
import { BidirectionalMapper } from '../../shared/mappers/mapper.interface';
import {
  CreateMessageDto,
  MessageDto,
  UpdateMessageDto,
} from '../dto/domain/message.dto';

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

    switch (messageType) {
      case MessageType.USER:
        return Message.createUserMessage(
          dto.content,
          { getValue: () => dto.userId } as any, // Simplified for now
          { getValue: () => crypto.randomUUID() } as any
        );
      case MessageType.BOT:
        return Message.createBotMessage(
          dto.content,
          { getValue: () => dto.userId } as any,
          { getValue: () => crypto.randomUUID() } as any
        );
      case MessageType.SYSTEM:
        return Message.createSystemMessage(
          dto.content,
          { getValue: () => dto.userId } as any,
          { getValue: () => crypto.randomUUID() } as any
        );
      case MessageType.ADMIN:
        return Message.createAdminMessage(
          dto.content,
          { getValue: () => dto.userId } as any,
          { getValue: () => crypto.randomUUID() } as any
        );
      default:
        return Message.createUserMessage(
          dto.content,
          { getValue: () => dto.userId } as any,
          { getValue: () => crypto.randomUUID() } as any
        );
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
