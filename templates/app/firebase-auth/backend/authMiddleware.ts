import { firebaseAdminAuth } from './firebaseAdmin';

type AuthenticatedRequest = {
  headers: Record<string, string | undefined>;
  user?: unknown;
};

type NextFunction = () => void;

export async function verifyFirebaseAuth(
  request: AuthenticatedRequest,
  next: NextFunction
): Promise<void> {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header');
  }

  const token = authorization.slice('Bearer '.length);
  request.user = await firebaseAdminAuth.verifyIdToken(token);
  next();
}
