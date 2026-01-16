/**
 * 🔧 Global Type Definitions for Strapi v5
 */

import type { SocketService } from './sockets';

declare module '@strapi/strapi' {
  interface Strapi {
    socketService?: SocketService;
  }
}

export {};