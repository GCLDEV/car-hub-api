// import type { Core } from '@strapi/strapi';

// Capturar erros EPERM globalmente para evitar crash no Windows
process.on('uncaughtException', (error: any) => {
  if (error.code === 'EPERM' && error.syscall === 'unlink') {
    console.warn('⚠️ Erro EPERM capturado globalmente (Windows):', error.path);
    return; // Não encerrar o processo
  }
  
  // Para outros erros, usar comportamento padrão
  console.error('❌ Erro não tratado:', error);
  process.exit(1);
});

async function setupRolesAndPermissions(strapi) {
  try {
    // Get the existing roles
    const publicRole = await strapi.query('plugin::users-permissions.role').findOne({
      where: { type: 'public' },
    });

    const authenticatedRole = await strapi.query('plugin::users-permissions.role').findOne({
      where: { type: 'authenticated' },
    });

    if (publicRole) {
      // Set permissions for public role (non-authenticated users)
      const publicPermissions = [
        // Car permissions - read only
        { action: 'api::car.car.find' },
        { action: 'api::car.car.findOne' },
        { action: 'api::car.car.search' }, // Allow public search
        
        // Auth permissions
        { action: 'plugin::users-permissions.auth.callback' },
        { action: 'plugin::users-permissions.auth.connect' },
        { action: 'plugin::users-permissions.auth.forgotPassword' },
        { action: 'plugin::users-permissions.auth.resetPassword' },
        { action: 'plugin::users-permissions.auth.register' },

        // Upload - read only
        { action: 'plugin::upload.content-api.find' },
        { action: 'plugin::upload.content-api.findOne' },
      ];

      await setRolePermissions(strapi, publicRole.id, publicPermissions);
    }

    if (authenticatedRole) {
      // Set permissions for authenticated role
      const authenticatedPermissions = [
        // Car permissions - full CRUD for own cars, read for others
        { action: 'api::car.car.find' },
        { action: 'api::car.car.findOne' },
        { action: 'api::car.car.create' },
        { action: 'api::car.car.update' },
        { action: 'api::car.car.delete' },
        { action: 'api::car.car.search' },       // Custom search endpoint
        { action: 'api::car.car.findUserCars' }, // Custom user cars endpoint

        // Favorite permissions - full CRUD for own favorites
        { action: 'api::favorite.favorite.find' },
        { action: 'api::favorite.favorite.create' },
        { action: 'api::favorite.favorite.delete' },

        // Message permissions - full CRUD for own messages
        { action: 'api::message.message.find' },
        { action: 'api::message.message.create' },
        { action: 'api::message.message.conversations' }, // Custom conversations endpoint

        // Conversation permissions
        { action: 'api::conversation.conversation.find' },
        { action: 'api::conversation.conversation.findOne' },
        { action: 'api::conversation.conversation.create' },

        // User permissions
        { action: 'plugin::users-permissions.user.me' },

        // Upload permissions
        { action: 'plugin::upload.content-api.find' },
        { action: 'plugin::upload.content-api.findOne' },
        { action: 'plugin::upload.content-api.upload' },
        { action: 'plugin::upload.content-api.destroy' },
      ];

      await setRolePermissions(strapi, authenticatedRole.id, authenticatedPermissions);
    }

  } catch (error) {
    console.error('❌ Error setting up roles and permissions:', error);
  }
}

async function setRolePermissions(strapi, roleId, permissions) {
  try {
    // Get existing permissions for this role
    const existingPermissions = await strapi.query('plugin::users-permissions.permission').findMany({
      where: { role: roleId },
    });

    // Create a map of existing permissions for quick lookup
    const existingActionsMap = new Map();
    existingPermissions.forEach(perm => {
      existingActionsMap.set(perm.action, perm);
    });

    // Create or update permissions
    for (const permission of permissions) {
      const existingPerm = existingActionsMap.get(permission.action);
      
      if (existingPerm) {
        // Update existing permission if it's disabled
        if (!existingPerm.enabled) {
          await strapi.query('plugin::users-permissions.permission').update({
            where: { id: existingPerm.id },
            data: { enabled: true }
          });
        }
      } else {
        // Create new permission
        await strapi.query('plugin::users-permissions.permission').create({
          data: {
            ...permission,
            role: roleId,
            enabled: true,
          },
        });
      }
    }
  } catch (error) {
    console.error('❌ Error setting role permissions:', error);
  }
}

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    console.log('🚀 Starting Strapi with Socket.io...');
    
    // Set up roles and permissions
    await setupRolesAndPermissions(strapi);

    // 🔌 Inicializar Socket.io com nossa implementação limpa
    try {
      const { SocketService } = await import('./sockets');
      const httpServer = strapi.server.httpServer;
      const socketService = SocketService.getInstance(httpServer, strapi);
      
      // 🌐 Tornar o socket service disponível globalmente
      strapi.socketService = socketService;
      
      console.log('✅ Socket.io initialized successfully');
      console.log('🎯 WebSocket available at: ws://localhost:1337');
      
    } catch (error) {
      console.error('❌ Erro ao inicializar WebSocket:', error);
    }
  },
};
