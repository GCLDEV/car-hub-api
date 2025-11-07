/**
 * Rate limiting middleware para push notifications
 * Conforme documentação Expo: máximo 600 notificações/segundo por projeto
 */

interface RateLimitStore {
  count: number;
  resetTime: number;
}

class PushNotificationRateLimit {
  private static instance: PushNotificationRateLimit;
  private store: Map<string, RateLimitStore> = new Map();
  private readonly maxRequests = 600; // por segundo
  private readonly windowMs = 1000; // 1 segundo

  static getInstance(): PushNotificationRateLimit {
    if (!PushNotificationRateLimit.instance) {
      PushNotificationRateLimit.instance = new PushNotificationRateLimit();
    }
    return PushNotificationRateLimit.instance;
  }

  /**
   * Verifica se a requisição está dentro do rate limit
   */
  checkRateLimit(projectId: string = 'default'): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const key = projectId;
    
    let bucket = this.store.get(key);
    
    if (!bucket || now >= bucket.resetTime) {
      // Reset do bucket
      bucket = {
        count: 0,
        resetTime: now + this.windowMs
      };
      this.store.set(key, bucket);
    }

    if (bucket.count >= this.maxRequests) {
      const retryAfter = Math.ceil((bucket.resetTime - now) / 1000);
      return {
        allowed: false,
        retryAfter
      };
    }

    bucket.count++;
    return { allowed: true };
  }

  /**
   * Middleware para Strapi
   */
  middleware() {
    return async (ctx: any, next: any) => {
      // Aplicar rate limiting apenas em rotas de push notification
      if (ctx.request.path.includes('/push-tokens/register') || 
          ctx.request.path.includes('/push-notifications/')) {
        
        const projectId = ctx.state.user?.id || 'anonymous';
        const result = this.checkRateLimit(projectId);
        
        if (!result.allowed) {
          ctx.status = 429;
          ctx.set('Retry-After', result.retryAfter?.toString() || '1');
          ctx.body = {
            error: 'TOO_MANY_REQUESTS',
            message: 'Rate limit exceeded for push notifications',
            retryAfter: result.retryAfter
          };
          return;
        }
      }
      
      await next();
    };
  }

  /**
   * Limpa buckets expirados (cleanup periódico)
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, bucket] of this.store.entries()) {
      if (now >= bucket.resetTime + this.windowMs) {
        this.store.delete(key);
      }
    }
  }
}

// Cleanup automático a cada 5 minutos
setInterval(() => {
  PushNotificationRateLimit.getInstance().cleanup();
}, 5 * 60 * 1000);

export default PushNotificationRateLimit;