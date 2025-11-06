export default ({ env }) => {
  return {
    upload: {
      config: {
        // 🆓 Cloudinary - 10GB grátis por mês
        provider: 'cloudinary',
        providerOptions: {
          cloud_name: env('CLOUDINARY_NAME'),
          api_key: env('CLOUDINARY_KEY'),
          api_secret: env('CLOUDINARY_SECRET'),
          secure: env.bool('CLOUDINARY_SECURE', true),
          cdn_subdomain: env.bool('CLOUDINARY_CDN_SUBDOMAIN', true),
        },
        actionOptions: {
          upload: {
            folder: env('CLOUDINARY_FOLDER', 'car-hub'),
            // Otimizações para carros
            transformation: [
              {
                width: 1200,
                height: 800,
                crop: 'fill',
                gravity: 'auto',
                quality: 'auto',
                format: 'auto'
              }
            ],
          },
          uploadStream: {},
          delete: {},
        },
      },
      sizeLimit: 10 * 1024 * 1024, // 10MB
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
  };
};
