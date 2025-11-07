import { Expo, ExpoPushMessage, ExpoPushReceipt, ExpoPushTicket } from 'expo-server-sdk';

interface NotificationData {
  conversationId?: string;
  messageId?: string;
  carId?: string;
  [key: string]: any;
}

interface SendNotificationParams {
  recipientId: string;
  senderId: string;
  title: string;
  body: string;
  type: 'message_from_buyer' | 'message_from_seller';
  data?: NotificationData;
}

class PushNotificationService {
  private expo: Expo;
  private maxRetries: number = 3;
  private baseDelay: number = 1000; // 1 segundo

  constructor() {
    this.expo = new Expo({
      accessToken: process.env.EXPO_ACCESS_TOKEN,
      useFcmV1: true,
      maxConcurrentRequests: 6 // Limitar conexões conforme documentação
    });
  }

  /**
   * Implementa retry com exponential backoff conforme documentação Expo
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    retryCount: number = 0
  ): Promise<T> {
    try {
      return await operation();
    } catch (error: any) {
      const shouldRetry = retryCount < this.maxRetries && this.isRetryableError(error);
      
      if (!shouldRetry) {
        throw error;
      }

      const delay = this.baseDelay * Math.pow(2, retryCount) + Math.random() * 1000;
      console.log(`Retry attempt ${retryCount + 1}/${this.maxRetries} in ${delay}ms`);
      
      await this.sleep(delay);
      return this.retryWithBackoff(operation, retryCount + 1);
    }
  }

  /**
   * Verifica se o erro é passível de retry
   */
  private isRetryableError(error: any): boolean {
    // Errors HTTP 429 (Too Many Requests) e 5xx são retryable
    if (error.response) {
      const status = error.response.status;
      return status === 429 || (status >= 500 && status < 600);
    }
    
    // Erros de rede também são retryable
    return error.code === 'ENOTFOUND' || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT';
  }

  /**
   * Helper para sleep/delay
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Envia push notification para um usuário específico
   */
  async sendNotification({
    recipientId,
    senderId,
    title,
    body,
    type,
    data = {}
  }: SendNotificationParams): Promise<boolean> {
    try {
      // Buscar tokens ativos do usuário destinatário
      const pushTokens = await strapi.db.query('api::push-token.push-token').findMany({
        where: {
          user: recipientId,
          isActive: true
        }
      });

      if (pushTokens.length === 0) {
        console.log(`No active push tokens found for user ${recipientId}`);
        return false;
      }

      const validTokens = pushTokens
        .map(tokenObj => tokenObj.token)
        .filter(token => Expo.isExpoPushToken(token));

      if (validTokens.length === 0) {
        console.log(`No valid Expo push tokens for user ${recipientId}`);
        return false;
      }

      // Criar mensagens de push notification seguindo formato oficial
      const messages: ExpoPushMessage[] = validTokens.map(token => ({
        to: token,
        sound: 'default',
        title: title.substring(0, 100), // Limitar título
        body: body.substring(0, 200),   // Limitar corpo
        data: {
          type,
          timestamp: Date.now(),
          ...data
        },
        priority: 'high',
        channelId: 'default',
        // TTL de 24 horas conforme documentação
        ttl: 24 * 60 * 60,
        // Badge para iOS
        badge: 1
      }));

      // Validar tamanho total da payload (máx 4KB conforme documentação)
      const totalSize = JSON.stringify(messages).length;
      if (totalSize > 4096) {
        console.warn(`⚠️ Payload size (${totalSize} bytes) approaching 4KB limit`);
      }

      // Enviar notificações em chunks com retry
      const chunks = this.expo.chunkPushNotifications(messages);
      const tickets: ExpoPushTicket[] = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await this.retryWithBackoff(async () => {
            return await this.expo.sendPushNotificationsAsync(chunk);
          });
          tickets.push(...ticketChunk);
          
          // Log de sucesso
          console.log(`✅ Push notification chunk sent successfully. Chunk size: ${chunk.length}`);
        } catch (error: any) {
          console.error('❌ Failed to send push notification chunk after retries:', {
            error: error.message,
            chunkSize: chunk.length,
            recipients: chunk.map(msg => msg.to)
          });
          
          // Continua com outros chunks mesmo se um falhar
          continue;
        }
      }

      // Salvar no histórico de notificações
      await strapi.db.query('api::push-notification.push-notification').create({
        data: {
          title,
          body,
          recipient: recipientId,
          sender: senderId,
          type,
          data: JSON.stringify(data),
          sentAt: new Date()
        }
      });

      // Processar recibos após 15 minutos conforme documentação Expo
      if (tickets.length > 0) {
        setTimeout(() => {
          this.processReceipts(tickets);
        }, 15 * 60 * 1000); // 15 minutos
      }

      return true;
    } catch (error) {
      console.error('Error in sendNotification:', error);
      return false;
    }
  }

  /**
   * Processa recibos de entrega das notificações conforme documentação Expo
   */
  private async processReceipts(tickets: ExpoPushTicket[]): Promise<void> {
    const receiptIds = tickets
      .filter(ticket => ticket.status === 'ok' && 'id' in ticket)
      .map(ticket => (ticket as any).id);

    if (receiptIds.length === 0) {
      console.log('📋 No receipt IDs to process');
      return;
    }

    console.log(`📋 Processing ${receiptIds.length} push notification receipts...`);

    try {
      const receiptIdChunks = this.expo.chunkPushNotificationReceiptIds(receiptIds);
      
      for (const chunk of receiptIdChunks) {
        try {
          const receipts = await this.retryWithBackoff(async () => {
            return await this.expo.getPushNotificationReceiptsAsync(chunk);
          });
          
          for (const receiptId in receipts) {
            const receipt: ExpoPushReceipt = receipts[receiptId];
            
            if (receipt.status === 'ok') {
              console.log(`✅ Push notification delivered successfully: ${receiptId}`);
            } else if (receipt.status === 'error') {
              console.error(`❌ Push notification delivery failed: ${receiptId}`, {
                message: receipt.message,
                details: receipt.details
              });
              
              // Handle specific errors conforme documentação
              const errorType = receipt.details?.error;
              if (errorType === 'DeviceNotRegistered') {
                console.log(`🚫 Device unregistered, deactivating token for receipt: ${receiptId}`);
                // Note: receiptId não corresponde diretamente ao token, 
                // mas podemos log para investigação manual
                console.log(`🔍 Receipt ID for manual investigation: ${receiptId}`);
              } else {
                // Log outros tipos de erro sem type checking específico
                console.error(`❌ Push notification error type: ${errorType}`, {
                  receiptId,
                  message: receipt.message,
                  details: receipt.details
                });
              }
            }
          }
        } catch (chunkError) {
          console.error(`❌ Failed to process receipt chunk after retries:`, chunkError);
        }
      }
    } catch (error) {
      console.error('❌ Error processing push notification receipts:', error);
    }
  }

  /**
   * Desativa um token inválido
   */
  private async deactivateToken(tokenId: string): Promise<void> {
    try {
      await strapi.db.query('api::push-token.push-token').updateMany({
        where: { token: tokenId },
        data: { isActive: false }
      });
    } catch (error) {
      console.error('Error deactivating token:', error);
    }
  }

  /**
   * Registra um novo token para o usuário
   */
  async registerToken(userId: string, token: string, deviceType: string = 'android'): Promise<boolean> {
    try {
      if (!Expo.isExpoPushToken(token)) {
        console.error('Invalid Expo push token:', token);
        return false;
      }

      // Verificar se o token já existe
      const existingToken = await strapi.db.query('api::push-token.push-token').findOne({
        where: { token, user: userId }
      });

      if (existingToken) {
        // Atualizar para ativo se existir
        await strapi.db.query('api::push-token.push-token').update({
          where: { id: existingToken.id },
          data: { isActive: true, deviceType }
        });
      } else {
        // Criar novo token
        await strapi.db.query('api::push-token.push-token').create({
          data: {
            token,
            user: userId,
            deviceType,
            isActive: true
          }
        });
      }

      return true;
    } catch (error) {
      console.error('Error registering push token:', error);
      return false;
    }
  }

  /**
   * Remove um token do usuário
   */
  async unregisterToken(userId: string, token: string): Promise<boolean> {
    try {
      await strapi.db.query('api::push-token.push-token').updateMany({
        where: { token, user: userId },
        data: { isActive: false }
      });

      return true;
    } catch (error) {
      console.error('Error unregistering push token:', error);
      return false;
    }
  }

  /**
   * Envia notificação quando vendedor recebe mensagem de comprador
   */
  async notifySellerNewMessage(sellerId: string, buyerId: string, carTitle: string, messageContent: string): Promise<boolean> {
    const buyer = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: buyerId },
      select: ['username', 'email']
    });

    return this.sendNotification({
      recipientId: sellerId,
      senderId: buyerId,
      title: 'Nova mensagem de comprador',
      body: `${buyer?.username || 'Comprador'} enviou uma mensagem sobre ${carTitle}`,
      type: 'message_from_buyer',
      data: {
        buyerId,
        carTitle,
        messageContent: messageContent.substring(0, 100)
      }
    });
  }

  /**
   * Envia notificação quando comprador recebe mensagem de vendedor
   */
  async notifyBuyerNewMessage(buyerId: string, sellerId: string, carTitle: string, messageContent: string): Promise<boolean> {
    const seller = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: sellerId },
      select: ['username', 'email']
    });

    return this.sendNotification({
      recipientId: buyerId,
      senderId: sellerId,
      title: 'Nova mensagem do vendedor',
      body: `${seller?.username || 'Vendedor'} respondeu sobre ${carTitle}`,
      type: 'message_from_seller',
      data: {
        sellerId,
        carTitle,
        messageContent: messageContent.substring(0, 100)
      }
    });
  }
}

export default new PushNotificationService();