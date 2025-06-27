import { authenticationService } from '../../services/authentication-service';

export async function isConnectionAuthenticated(
  connectionId: string
): Promise<boolean> {
  return authenticationService.isConnectionAuthenticated(connectionId);
}
