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

        // Favorite permissions - full CRUD for own favorites
        { action: 'api::favorite.favorite.find' },
        { action: 'api::favorite.favorite.create' },
        { action: 'api::favorite.favorite.delete' },

        // Message permissions - full CRUD for own messages
        { action: 'api::message.message.find' },
        { action: 'api::message.message.create' },

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
  // Clear existing permissions for this role
  await strapi.query('plugin::users-permissions.permission').deleteMany({
    where: { role: roleId },
  });

  // Create new permissions
  for (const permission of permissions) {
    await strapi.query('plugin::users-permissions.permission').create({
      data: {
        ...permission,
        role: roleId,
        enabled: true,
      },
    });
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
    // Set up roles and permissions
    await setupRolesAndPermissions(strapi);
  },
};
