/**
 * Rate limiting middleware para push notifications - Strapi v5 format
 */
export default (config: any, { strapi }: any) => {
  return async (ctx: any, next: any) => {
    // Rate limiting simplificado por enquanto
    // TODO: Implementar rate limiting robusto depois
    await next();
  };
};