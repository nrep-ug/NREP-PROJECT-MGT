'use client';

import { account } from './appwriteClient';

let cachedJwt = null;
let jwtExpiresAt = 0;

async function createSessionJwt() {
  const token = await account.createJWT();
  cachedJwt = token.jwt;
  // Appwrite JWTs are short lived. Refresh early so an in-flight request never
  // depends on a token that is about to expire.
  jwtExpiresAt = Date.now() + (12 * 60 * 1000);
  return cachedJwt;
}

export async function getSessionJwt({ forceRefresh = false } = {}) {
  if (!forceRefresh && cachedJwt && Date.now() < jwtExpiresAt) {
    return cachedJwt;
  }
  return createSessionJwt();
}

export function clearSessionJwt() {
  cachedJwt = null;
  jwtExpiresAt = 0;
}

/**
 * Call a Next.js API route with a JWT minted from the current Appwrite
 * browser session. The server validates the token with Appwrite and derives
 * the caller identity, organization and controlled labels itself.
 */
export async function authenticatedFetch(input, init = {}) {
  const execute = async (forceRefresh) => {
    const jwt = await getSessionJwt({ forceRefresh });
    const headers = new Headers(init.headers || {});
    headers.set('Authorization', `Bearer ${jwt}`);
    return fetch(input, { ...init, headers });
  };

  let response = await execute(false);
  if (response.status === 401) {
    clearSessionJwt();
    response = await execute(true);
  }
  return response;
}

