export default ({ env }) => ({
  upload: {
    config: {
      provider: 'local',
      sizeLimit: 10 * 1024 * 1024, // 10MB
      providerOptions: {},
    },
  },
  'users-permissions': {
    config: {
      jwt: {
        expiresIn: '7d',
      },
    },
  },
});
