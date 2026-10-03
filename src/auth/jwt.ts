import jwt from "jsonwebtoken";
import { config } from "../config.js";
import type { Role } from "../../shared/types.js";

export interface TokenPayload {
  userId: string;
  email: string;
  role: Role;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
    algorithm: 'HS256',
    issuer: 'uzhunnungal-traders',
    audience: 'ut-internal'
  } as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, config.JWT_SECRET, {
    algorithms: ['HS256'],
    issuer: 'uzhunnungal-traders',
    audience: 'ut-internal'
  }) as TokenPayload;
}
