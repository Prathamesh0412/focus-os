import { prisma } from './prisma';

/**
 * Prototype auth: validates API key and returns the associated user.
 * Extension sends X-API-Key header with requests.
 */
export async function validateApiKey(apiKey: string | null) {
  if (!apiKey) {
    return null;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { apiKey },
    });
    return user;
  } catch {
    return null;
  }
}

/**
 * Get user from request headers (for API routes)
 */
export async function getUserFromRequest(request: Request) {
  const apiKey = request.headers.get('X-API-Key');
  return validateApiKey(apiKey);
}
