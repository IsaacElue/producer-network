// Verifies the Supabase access token the app sends as a Bearer token, so only
// signed-in Producer Network users can hit the Spotify proxy.
//
// Requires the Supabase project to use asymmetric JWT signing keys (the
// default for new projects; older projects can migrate under
// Auth → JWT Keys in the dashboard) so tokens verify against the public
// JWKS endpoint with no shared secret on this server.

import { createRemoteJWKSet, jwtVerify } from 'jose';

let jwks = null;

export function requireSupabaseUser() {
  return async (req, res, next) => {
    const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
    if (!token) {
      return res.status(401).json({ error: 'Missing bearer token' });
    }
    try {
      jwks ??= createRemoteJWKSet(
        new URL(`${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`),
      );
      const { payload } = await jwtVerify(token, jwks);
      req.userId = payload.sub;
      next();
    } catch {
      res.status(401).json({ error: 'Invalid token' });
    }
  };
}
