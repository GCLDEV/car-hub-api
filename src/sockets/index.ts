/**
 * 🔌 Socket.io Configuration for Strapi v5
 * 
 * Implementação limpa e desacoplada para chat em tempo real
 * Seguindo melhores práticas para Strapi v5
 */

import { Socket, Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import type { Core } from '@strapi/strapi';
import { authMiddleware } from './middleware/auth';
import { connectionHandler } from './handlers/connection';

export interface AuthenticatedSocket extends Socket {
  userId: string;
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
  };
}

export class SocketService {
  private io: SocketIOServer;
  public static _instance: SocketService;
  private strapiInstance: Core.Strapi;

  private constructor(httpServer: HTTPServer, strapi: Core.Strapi) {
    this.strapiInstance = strapi;
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: [
          "http://localhost:3000",
          "http://localhost:19006", // Expo Dev
          "exp://localhost:19006",   // Expo Local
          /^https?:\/\/.*\.exp\.direct(:\d+)?$/,  // Expo Published
          /^https?:\/\/.*\.ngrok\.io$/,           // Ngrok tunnels
        ],
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.setupMiddleware();
    this.setupHandlers();
  }

  public static getInstance(httpServer?: HTTPServer, strapi?: Core.Strapi): SocketService {
    if (!SocketService._instance && httpServer && strapi) {
      SocketService._instance = new SocketService(httpServer, strapi);
    }
    return SocketService._instance;
  }

  private setupMiddleware(): void {
    // 🔐 Middleware de autenticação JWT
    this.io.use((socket, next) => authMiddleware(socket, next, this.strapiInstance));
  }

  private setupHandlers(): void {
    // 📡 Handler principal de conexões
    this.io.on('connection', (socket) => connectionHandler(socket, this.strapiInstance));
  }

  public getIO(): SocketIOServer {
    return this.io;
  }

  public emitToUser(userId: string, event: string, data: any): void {
    this.io.to(`user-${userId}`).emit(event, data);
  }

  public emitToRoom(room: string, event: string, data: any): void {
    this.io.to(room).emit(event, data);
  }

  public getUserSocketCount(userId: string): number {
    const userRoom = this.io.sockets.adapter.rooms.get(`user-${userId}`);
    return userRoom ? userRoom.size : 0;
  }

  public getStrapi(): Core.Strapi {
    return this.strapiInstance;
  }
}

// 🌐 Função auxiliar para obter a instância global
export function getSocketService(): SocketService | null {
  return SocketService._instance || null;
}