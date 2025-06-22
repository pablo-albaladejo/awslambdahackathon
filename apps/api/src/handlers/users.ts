import type { User } from '@awslambdahackathon/types';
import { createErrorResponse, createSuccessResponse } from '@awslambdahackathon/utils';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

// Mock database - replace with actual DynamoDB implementation
const users: User[] = [
  {
    id: '1',
    email: 'john@example.com',
    name: 'John Doe',
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
  },
];

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  try {
    const { httpMethod, pathParameters } = event;

    switch (httpMethod) {
      case 'GET':
        if (pathParameters?.id) {
          // Get user by ID
          const user = users.find((u) => u.id === pathParameters.id);
          if (!user) {
            return createErrorResponse('User not found', 404);
          }
          return createSuccessResponse(user);
        } else {
          // Get all users
          return createSuccessResponse(users);
        }

      case 'POST':
        // Create new user
        const body = JSON.parse(event.body || '{}');
        const newUser: User = {
          id: Date.now().toString(),
          email: body.email,
          name: body.name,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        users.push(newUser);
        return createSuccessResponse(newUser, 201);

      case 'PUT':
        // Update user
        if (!pathParameters?.id) {
          return createErrorResponse('User ID is required', 400);
        }
        const updateBody = JSON.parse(event.body || '{}');
        const userIndex = users.findIndex((u) => u.id === pathParameters.id);
        if (userIndex === -1) {
          return createErrorResponse('User not found', 404);
        }
        users[userIndex] = {
          ...users[userIndex],
          ...updateBody,
          updatedAt: new Date(),
        };
        return createSuccessResponse(users[userIndex]);

      case 'DELETE':
        // Delete user
        if (!pathParameters?.id) {
          return createErrorResponse('User ID is required', 400);
        }
        const deleteIndex = users.findIndex((u) => u.id === pathParameters.id);
        if (deleteIndex === -1) {
          return createErrorResponse('User not found', 404);
        }
        const deletedUser = users.splice(deleteIndex, 1)[0];
        return createSuccessResponse({ message: 'User deleted successfully', user: deletedUser });

      default:
        return createErrorResponse('Method not allowed', 405);
    }
  } catch (error) {
    console.error('Error in users handler:', error);
    return createErrorResponse('Internal server error', 500);
  }
}; 