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
  let token: string | undefined;
  
  try {
    console.log('🔐 [WebSocket] Middleware de autenticação executado');
    token = (socket.handshake.auth.token as string) || (socket.handshake.query.token as string);

    // 🔓 Permitir conexões sem token para desenvolvimento/teste
    if (!token) {
      console.log('🧪 [WebSocket] Conexão sem token - modo de teste');
      // Criar um usuário anônimo para teste
      (socket as AuthenticatedSocket).userId = 'anonymous';
      (socket as AuthenticatedSocket).user = {
        id: 'anonymous',
        username: 'TestUser',
        email: 'test@example.com',
        role: 'test'
      };
      console.log('✅ [WebSocket] Usuário anônimo criado para teste');
      return next();
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
    console.log(`🔍 [WebSocket] Buscando usuário com ID: ${decoded.id}`);
    
    const user = await strapi.documents('plugin::users-permissions.user').findOne({
      documentId: decoded.id.toString(),
      populate: ['role'],
    });

    // Se não encontrar por documentId, tenta por ID numérico (compatibilidade)
    let finalUser = user;
    if (!user) {
      console.log(`🔍 [WebSocket] Tentando busca por ID numérico: ${decoded.id}`);
      
      const users = await strapi.documents('plugin::users-permissions.user').findMany({
        filters: { id: decoded.id },
        populate: ['role'],
      });
      
      finalUser = users.length > 0 ? users[0] : null;
    }

    if (!finalUser) {
      console.error(`❌ [WebSocket] Usuário não encontrado: ID=${decoded.id}`);
      return next(new Error('User not found'));
    }

    if (!finalUser.confirmed) {
      return next(new Error('User account not confirmed'));
    }

    if (finalUser.blocked) {
      return next(new Error('User account is blocked'));
    }

    // ✅ Adicionar dados do usuário ao socket
    const authSocket = socket as AuthenticatedSocket;
    authSocket.userId = finalUser.documentId || finalUser.id.toString();
    authSocket.user = {
      id: finalUser.documentId || finalUser.id.toString(),
      username: finalUser.username,
      email: finalUser.email,
      role: finalUser.role?.name || 'authenticated'
    };

    console.log(`✅ [WebSocket] User authenticated: ${finalUser.username} (ID: ${finalUser.documentId || finalUser.id})`);
    next();
    
  } catch (error: any) {
    console.error('❌ [WebSocket] Socket authentication error:', {
      message: error.message,
      name: error.name,
      tokenProvided: !!token,
      tokenLength: token?.length
    });
    
    if (error.name === 'JsonWebTokenError') {
      console.error('🔐 [WebSocket] Erro de autenticação JWT - token inválido ou assinatura incorreta');
      console.error('💡 [WebSocket] Possíveis causas:');
      console.error('    - JWT_SECRET diferente no servidor');
      console.error('    - Token expirado'); 
      console.error('    - Usuário foi removido/desabilitado');
      return next(new Error('User not found'));
    }
    
    if (error.name === 'TokenExpiredError') {
      return next(new Error('Token expired'));
    }
    
    next(new Error('Authentication failed'));
  }
}