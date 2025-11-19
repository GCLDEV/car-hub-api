/**
 * Push Notification Service
 * Handles sending push notifications via Expo Push API
 */

import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk'

// Cria uma instância do cliente Expo
const expo = new Expo()

export interface PushNotificationData {
  type: 'message' | 'car_sold' | 'car_interest'
  conversationId?: string
  carId?: string
  senderId?: string
  [key: string]: any
}

class PushNotificationService {
  /**
   * Envia uma notificação push para um usuário específico
   */
  async sendToUser(
    userId: string, 
    title: string, 
    body: string, 
    data: PushNotificationData = {} as PushNotificationData
  ): Promise<boolean> {
    try {
      // Buscar tokens ativos do usuário
      const pushTokens = await strapi.entityService.findMany('api::push-token.push-token' as any, {
        filters: {
          user: userId,
          isActive: true
        }
      })

      if (pushTokens.length === 0) {
        console.log(`📱 Nenhum push token ativo encontrado para usuário ${userId}`)
        return false
      }

      // Preparar mensagens
      const messages: ExpoPushMessage[] = pushTokens
        .filter((tokenData: any) => Expo.isExpoPushToken(tokenData.token))
        .map((tokenData: any) => ({
          to: tokenData.token,
          sound: 'default' as const,
          title,
          body,
          data,
          badge: 1 // Será atualizado com contagem real se necessário
        }))

      if (messages.length === 0) {
        console.log(`📱 Nenhum token válido encontrado para usuário ${userId}`)
        return false
      }

      // Enviar notificações em chunks
      const chunks = expo.chunkPushNotifications(messages)
      const tickets: ExpoPushTicket[] = []

      for (const chunk of chunks) {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk)
          tickets.push(...ticketChunk)
          console.log(`📱 Chunk de notificações enviado:`, ticketChunk)
        } catch (error) {
          console.error('❌ Erro ao enviar chunk de notificações:', error)
        }
      }

      // Log de sucesso
      console.log(`✅ ${tickets.length} notificação(ões) enviada(s) para usuário ${userId}`)
      console.log(`📱 Título: ${title}`)
      console.log(`📱 Corpo: ${body}`)
      console.log(`📱 Data:`, data)

      return tickets.length > 0

    } catch (error) {
      console.error('❌ Erro no serviço de push notification:', error)
      return false
    }
  }

  /**
   * Notifica o comprador sobre nova mensagem do vendedor
   */
  async notifyBuyerNewMessage(
    buyerId: string,
    sellerId: string, 
    carTitle: string,
    messageContent: string,
    conversationId: string
  ): Promise<boolean> {
    const title = `Nova mensagem sobre ${carTitle}`
    const body = `Vendedor: ${messageContent.substring(0, 100)}${messageContent.length > 100 ? '...' : ''}`
    
    const data: PushNotificationData = {
      type: 'message',
      conversationId,
      senderId: sellerId
    }

    return this.sendToUser(buyerId, title, body, data)
  }

  /**
   * Notifica o vendedor sobre nova mensagem do comprador
   */
  async notifySellerNewMessage(
    sellerId: string,
    buyerId: string,
    carTitle: string, 
    messageContent: string,
    conversationId: string
  ): Promise<boolean> {
    const title = `Nova mensagem sobre ${carTitle}`
    const body = `Comprador: ${messageContent.substring(0, 100)}${messageContent.length > 100 ? '...' : ''}`
    
    const data: PushNotificationData = {
      type: 'message', 
      conversationId,
      senderId: buyerId
    }

    return this.sendToUser(sellerId, title, body, data)
  }

  /**
   * Notifica usuários interessados quando um carro é vendido
   */
  async notifyCarSold(
    carId: string,
    carTitle: string,
    sellerId: string
  ): Promise<boolean> {
    try {
      // Encontrar usuários que favoritaram este carro
      const favorites = await strapi.entityService.findMany('api::favorite.favorite' as any, {
        filters: {
          car: {
            id: carId
          }
        },
        populate: ['user']
      })

      if (favorites.length === 0) {
        console.log(`📱 Nenhum favorito encontrado para o carro ${carId}`)
        return false
      }

      const title = 'Carro vendido!'
      const body = `O carro "${carTitle}" que você favoritou foi vendido.`
      
      const data: PushNotificationData = {
        type: 'car_sold',
        carId
      }

      // Enviar notificação para todos os usuários que favoritaram (exceto o vendedor)
      const promises = favorites
        .filter((favorite: any) => favorite.user?.id !== sellerId)
        .map((favorite: any) => 
          this.sendToUser(favorite.user.id, title, body, data)
        )

      const results = await Promise.allSettled(promises)
      const successCount = results.filter(result => result.status === 'fulfilled' && result.value).length

      console.log(`✅ ${successCount}/${promises.length} notificações de carro vendido enviadas`)
      return successCount > 0

    } catch (error) {
      console.error('❌ Erro ao notificar carro vendido:', error)
      return false
    }
  }

  /**
   * Notifica o vendedor quando alguém demonstra interesse em seu carro
   */
  async notifyCarInterest(
    sellerId: string,
    buyerId: string,
    carTitle: string,
    carId: string
  ): Promise<boolean> {
    const title = 'Alguém se interessou pelo seu carro!'
    const body = `Um comprador demonstrou interesse em "${carTitle}"`
    
    const data: PushNotificationData = {
      type: 'car_interest',
      carId,
      senderId: buyerId
    }

    return this.sendToUser(sellerId, title, body, data)
  }
}

// Exportar instância única do serviço
const pushNotificationService = new PushNotificationService()
export default pushNotificationService