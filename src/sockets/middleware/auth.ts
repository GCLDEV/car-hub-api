/**
 * 🛡️ Socket.io JWT Authentication Middleware
 * 
 * Autentica usuários usando tokens JWT do Strapi
 */

import jwt from 'jsonwebtoken';
import type { Socket } from 'socket.io';
import type { Core } from '@strapi/strapi';
import type { AuthenticatedSocket } from '../index';

interface JWTPayload {
  id: number;
  iat: number;
  exp: number;
}

export async function authMiddleware(
  socket: Socket, 
  next: (err?: Error) => void,
  strapi: Core.Strapi
): Promise<void> {
  try {
    const token = (socket.handshake.auth.token as string) || (socket.handshake.query.token as string);

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    // 🔑 Verificar token JWT
    const jwtSecret = process.env.JWT_SECRET || strapi.config.get('plugin::users-permissions.jwt.secret');
    
    if (!jwtSecret) {
      return next(new Error('JWT secret not configured'));
    }

    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
    
    if (!decoded.id) {
      return next(new Error('Invalid token payload'));
    }

    // 👤 Buscar usuário no banco de dados usando Strapi v5 API
    const user = await strapi.documents('plugin::users-permissions.user').findOne({
      documentId: decoded.id.toString(),
      populate: ['role'],
    });

    if (!user) {
      return next(new Error('User not found'));
    }

    if (!user.confirmed) {
      return next(new Error('User account not confirmed'));
    }

    if (user.blocked) {
      return next(new Error('User account is blocked'));
    }

    // ✅ Adicionar dados do usuário ao socket
    const authSocket = socket as AuthenticatedSocket;
    authSocket.userId = user.documentId;
    authSocket.user = {
      id: user.documentId,
      username: user.username,
      email: user.email,
      role: user.role?.name || 'authenticated'
    };

    console.log(`🔌 User authenticated: ${user.username} (ID: ${user.documentId})`);
    next();
    
  } catch (error: any) {
    console.error('❌ Socket authentication error:', error.message);
    
    if (error.name === 'JsonWebTokenError') {
      return next(new Error('Invalid token'));
    }
    
    if (error.name === 'TokenExpiredError') {
      return next(new Error('Token expired'));
    }
    
    next(new Error('Authentication failed'));
  }
}