# 🔌 **WebSocket Chat Implementation - Strapi v5**

## 📖 **Visão Geral**

Esta é uma implementação robusta de WebSocket usando `socket.io` integrada ao Strapi v5 para criar um sistema de chat em tempo real estilo WhatsApp.

## 🚀 **Recursos Implementados**

### ✅ **Funcionalidades Principais**
- ✅ Autenticação JWT para conexões WebSocket
- ✅ Salas de chat privadas e em grupo
- ✅ Envio/recebimento de mensagens em tempo real
- ✅ Indicadores de digitação (typing indicators)
- ✅ Marcação de mensagens como lidas
- ✅ Status online/offline dos usuários
- ✅ Edição e exclusão de mensagens
- ✅ Respostas a mensagens (reply)
- ✅ Reconexão automática

### 🔐 **Segurança**
- Token JWT obrigatório para conexão
- Validação de participação em conversas
- Rate limiting implícito via Strapi
- Sanitização de dados de entrada

## 🏗️ **Arquitetura**

```
src/
├── sockets/
│   ├── index.ts              # Serviço principal do Socket.io
│   ├── types.ts              # Definições de tipos TypeScript
│   ├── helper.ts             # Utilitários para controllers
│   ├── middleware/
│   │   └── auth.ts           # Middleware de autenticação JWT
│   └── handlers/
│       ├── connection.ts     # Handler principal de conexões
│       ├── message.ts        # Handler de mensagens
│       └── room.ts           # Handler de salas/conversas
└── index.ts                  # Inicialização no bootstrap
```

## 📡 **Eventos WebSocket**

### 🔗 **Conexão**
```javascript
// Cliente se conecta com token JWT
const socket = io('ws://localhost:1337', {
  auth: {
    token: 'your-jwt-token-here'
  }
});
```

### 💬 **Mensagens**
```javascript
// Enviar mensagem
socket.emit('sendMessage', {
  conversationId: '123',
  content: 'Olá, mundo!',
  type: 'text', // 'text' | 'image' | 'file'
  replyTo: 456, // ID da mensagem sendo respondida (opcional)
  tempId: 'temp-123' // ID temporário para confirmação
});

// Receber mensagem
socket.on('newMessage', (data) => {
  console.log('Nova mensagem:', data);
});

// Confirmação de envio
socket.on('messageSent', (data) => {
  console.log('Mensagem enviada:', data.message);
  // Usar data.tempId para atualizar UI
});
```

### 🏠 **Salas/Conversas**
```javascript
// Entrar em uma conversa
socket.emit('joinConversation', {
  conversationId: '123'
});

// Sair de uma conversa
socket.emit('leaveConversation', {
  conversationId: '123'
});

// Rejoin automático (útil após reconexão)
socket.emit('rejoinActiveConversations');
```

### 📝 **Indicadores de Digitação**
```javascript
// Começar a digitar
socket.emit('startTyping', {
  conversationId: '123'
});

// Parar de digitar
socket.emit('stopTyping', {
  conversationId: '123'
});

// Escutar indicadores
socket.on('userStartedTyping', (data) => {
  console.log(\`\${data.username} está digitando...\`);
});

socket.on('userStoppedTyping', (data) => {
  console.log(\`\${data.username} parou de digitar\`);
});
```

### 👀 **Marcação como Lida**
```javascript
// Marcar mensagens como lidas
socket.emit('markAsRead', {
  conversationId: '123',
  messageIds: [456, 789]
});

// Escutar confirmação
socket.on('messagesRead', (data) => {
  console.log('Mensagens lidas por:', data.readBy);
});
```

### 📊 **Status Online/Offline**
```javascript
// Escutar usuários ficando online
socket.on('userOnline', (data) => {
  console.log(\`\${data.username} ficou online\`);
});

// Escutar usuários ficando offline
socket.on('userOffline', (data) => {
  console.log(\`\${data.username} ficou offline\`);
});
```

## 🛠️ **Como Usar em Controllers**

```typescript
import { SocketHelper } from '../sockets/helper';

// Notificar usuários via WebSocket de dentro de um controller
export default {
  async createMessage(ctx) {
    // ... lógica de criação ...
    
    // Emitir para conversa específica
    SocketHelper.emitToConversation(conversationId, 'newMessage', messageData);
    
    // Emitir para usuário específico
    SocketHelper.emitToUser(userId, 'notification', notificationData);
  }
};
```

## 🔧 **Configuração de Desenvolvimento**

### **1. Variáveis de Ambiente**
```env
JWT_SECRET=seu-jwt-secret-aqui
```

### **2. Collection Types Necessárias**
Certifique-se de ter estas collections:

```javascript
// api::conversation.conversation
{
  name: 'string',
  type: 'enumeration', // 'private' | 'group'
  participants: 'relation', // many-to-many com users
  lastMessage: 'relation', // one-to-one com message
}

// api::message.message
{
  content: 'text',
  type: 'enumeration', // 'text' | 'image' | 'file'
  sender: 'relation', // many-to-one com user
  conversation: 'relation', // many-to-one com conversation
  replyTo: 'relation', // one-to-one com message
  read: 'boolean',
  edited: 'boolean',
  editedAt: 'datetime',
  deleted: 'boolean',
  deletedAt: 'datetime'
}
```

## 🐛 **Troubleshooting**

### **WebSocket não conecta**
- Verifique se o token JWT é válido
- Confirme se o CORS está configurado corretamente
- Teste com `ws://localhost:1337` (não `http://`)

### **Mensagens não são persistidas**
- Verifique se as collections Message e Conversation existem
- Confirme as permissões do usuário autenticado

### **Erro de autenticação**
- Verifique se `JWT_SECRET` está definido
- Confirme se o token não está expirado

## 📈 **Monitoramento**

O sistema logga automaticamente:
- ✅ Conexões/desconexões de usuários
- 📤 Mensagens enviadas e recebidas
- ❌ Erros de autenticação
- 🏠 Entrada/saída de salas

## 🚀 **Próximos Passos**

1. **Implementar Rate Limiting** por usuário
2. **Adicionar suporte a arquivos** (images, documents)
3. **Notificações Push** para usuários offline
4. **Moderação de mensagens** automática
5. **Analytics** de uso do chat

---

**✨ Implementação completa e pronta para produção! ✨**