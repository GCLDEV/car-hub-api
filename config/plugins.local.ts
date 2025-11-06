// 📁 Configuração de Upload Local (Fallback)
// Use esta configuração se quiser testar sem configurar nenhum serviço externo
// Substitua o conteúdo de config/plugins.ts temporariamente

export default ({ env }) => {
  return {
    upload: {
      config: {
        // 💾 Provider local - Armazena no próprio servidor
        provider: 'local',
        providerOptions: {
          sizeLimit: 10 * 1024 * 1024, // 10MB
        },
      },
    },
    'users-permissions': {
      config: {
        jwt: {
          expiresIn: '7d',
        },
        ratelimit: {
          enabled: true,
          max: 5,
          duration: 60000,
          endpoints: [
            'api/auth/local',
            'api/auth/local/register',
            'api/auth/forgot-password',
            'api/auth/reset-password',
          ],
        },
      },
    },
  };
};