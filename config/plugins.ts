export default ({ env }) => {
  const useS3 = env('USE_S3', 'false') === 'true';
  
  return {
    upload: {
      config: useS3 
        ? {
            // Configuração S3 (baseada na documentação oficial)
            provider: 'aws-s3',
            providerOptions: {
              s3Options: {
                credentials: {
                  accessKeyId: env('AWS_ACCESS_KEY_ID'),
                  secretAccessKey: env('AWS_ACCESS_SECRET'),
                },
                region: env('AWS_REGION', 'us-east-1'),
                params: {
                  signedUrlExpires: env('AWS_SIGNED_URL_EXPIRES', 15 * 60),
                  Bucket: env('AWS_S3_BUCKET', 'car-hub-storage'),
                },
              },
            },
            actionOptions: {
              upload: {},
              uploadStream: {},
              delete: {},
            },
          }
        : {
            // Configuração Local (fallback)
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
      // Configurações de breakpoints movidas para o nível superior
      breakpoints: {
        xlarge: 1920,
        large: 1000,
        medium: 750,
        small: 500,
        xsmall: 64
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
