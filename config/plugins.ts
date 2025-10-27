export default ({ env }) => ({
  upload: {
    config: {
      provider: 'local',
      providerOptions: {
        sizeLimit: 10 * 1024 * 1024, // 10MB
      },
      actionOptions: {
        upload: {},
        uploadStream: {},
        delete: {},
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
        max: 5, // 5 requests per minute for auth endpoints
        duration: 60000, // 1 minute
        endpoints: [
          'api/auth/local',
          'api/auth/local/register',
          'api/auth/forgot-password',
          'api/auth/reset-password',
        ],
      },
    },
  },
});
