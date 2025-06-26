import { z } from 'zod';

import { EmailSchema, IdSchema, TimestampSchema } from './schemas';

// JWT token schema
export const JWTTokenSchema = z.object({
  sub: IdSchema, // Subject (user ID)
  iss: z.string().min(1), // Issuer
  aud: z.string().min(1), // Audience
  exp: z.number().int(), // Expiration time
  iat: z.number().int(), // Issued at
  'cognito:groups': z.array(z.string()).optional(),
  'cognito:username': z.string().min(1).optional(),
  email: EmailSchema.optional(),
  email_verified: z.boolean().optional(),
  name: z.string().optional(),
  given_name: z.string().optional(),
  family_name: z.string().optional(),
});

// Cognito user attributes schema
export const CognitoUserAttributesSchema = z.object({
  sub: IdSchema,
  email: EmailSchema,
  email_verified: z.boolean(),
  name: z.string().optional(),
  given_name: z.string().optional(),
  family_name: z.string().optional(),
  'custom:groups': z.string().optional(), // Comma-separated groups
});

// User authentication state schema
export const UserAuthStateSchema = z.object({
  isAuthenticated: z.boolean(),
  user: z
    .object({
      id: IdSchema,
      email: EmailSchema,
      username: z.string().min(1),
      groups: z.array(z.string()),
      attributes: CognitoUserAttributesSchema.optional(),
    })
    .optional(),
  session: z
    .object({
      accessToken: z.string().min(1),
      refreshToken: z.string().min(1).optional(),
      expiresAt: TimestampSchema,
    })
    .optional(),
  error: z.string().optional(),
});

// Authentication request schema
export const AuthRequestSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(8),
  rememberMe: z.boolean().default(false),
});

// Authentication response schema
export const CognitoAuthResponseSchema = z.object({
  success: z.boolean(),
  user: z
    .object({
      id: IdSchema,
      email: EmailSchema,
      username: z.string().min(1),
      groups: z.array(z.string()),
    })
    .optional(),
  session: z
    .object({
      accessToken: z.string().min(1),
      refreshToken: z.string().min(1).optional(),
      expiresAt: TimestampSchema,
    })
    .optional(),
  error: z.string().optional(),
  requiresNewPassword: z.boolean().default(false),
  requiresMFA: z.boolean().default(false),
});

// Password change schema
export const PasswordChangeSchema = z
  .object({
    oldPassword: z.string().min(8),
    newPassword: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine(data => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

// MFA verification schema
export const MFAVerificationSchema = z.object({
  code: z
    .string()
    .length(6)
    .regex(/^\d{6}$/),
  session: z.string().min(1),
});

// User registration schema
export const UserRegistrationSchema = z
  .object({
    email: EmailSchema,
    password: z
      .string()
      .min(8)
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
        {
          message:
            'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        }
      ),
    confirmPassword: z.string().min(8),
    firstName: z.string().min(1).max(50),
    lastName: z.string().min(1).max(50),
    acceptTerms: z.boolean().refine(val => val === true, {
      message: 'You must accept the terms and conditions',
    }),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

// Permission schema
export const PermissionSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  resource: z.string().min(1),
  action: z.enum(['create', 'read', 'update', 'delete', 'execute']),
  conditions: z.record(z.unknown()).optional(),
});

// Role schema
export const RoleSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  permissions: z.array(PermissionSchema),
  isDefault: z.boolean().default(false),
});

// Group membership schema
export const GroupMembershipSchema = z.object({
  userId: IdSchema,
  groupId: IdSchema,
  role: z.string().min(1),
  joinedAt: TimestampSchema,
  expiresAt: TimestampSchema.optional(),
});

// Type exports
export type JWTToken = z.infer<typeof JWTTokenSchema>;
export type CognitoUserAttributes = z.infer<typeof CognitoUserAttributesSchema>;
export type UserAuthState = z.infer<typeof UserAuthStateSchema>;
export type AuthRequest = z.infer<typeof AuthRequestSchema>;
export type CognitoAuthResponse = z.infer<typeof CognitoAuthResponseSchema>;
export type PasswordChange = z.infer<typeof PasswordChangeSchema>;
export type MFAVerification = z.infer<typeof MFAVerificationSchema>;
export type UserRegistration = z.infer<typeof UserRegistrationSchema>;
export type Permission = z.infer<typeof PermissionSchema>;
export type Role = z.infer<typeof RoleSchema>;
export type GroupMembership = z.infer<typeof GroupMembershipSchema>;

// Helper functions for JWT validation
export const validateJWTToken = (token: string): JWTToken => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return JWTTokenSchema.parse(payload);
  } catch (error) {
    throw new Error('Invalid JWT token');
  }
};

export const isTokenExpired = (token: JWTToken): boolean => {
  return Date.now() >= token.exp * 1000;
};

export const getTokenExpirationTime = (token: JWTToken): Date => {
  return new Date(token.exp * 1000);
};

// Helper functions for user groups
export const hasGroup = (
  user: UserAuthState['user'],
  groupName: string
): boolean => {
  return user?.groups.includes(groupName) ?? false;
};

export const hasAnyGroup = (
  user: UserAuthState['user'],
  groupNames: string[]
): boolean => {
  return user?.groups.some(group => groupNames.includes(group)) ?? false;
};

export const hasAllGroups = (
  user: UserAuthState['user'],
  groupNames: string[]
): boolean => {
  return user?.groups.every(group => groupNames.includes(group)) ?? false;
};

// Permission checking helpers
export const hasPermission = (
  user: UserAuthState['user']
  // resource: string,
  // action: Permission['action']
): boolean => {
  // This would typically check against user's roles and permissions
  // For now, we'll implement a simple group-based permission system
  if (!user) return false;

  const adminGroups = ['Admins', 'SuperAdmins'];
  if (hasAnyGroup(user, adminGroups)) return true;

  // Add more specific permission logic here
  return false;
};
