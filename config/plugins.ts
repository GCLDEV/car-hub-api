export default ({ env }) => {
  return {
    upload: {
      config: {
        // Configuração AWS S3 baseada na documentação oficial Strapi v5
        provider: 'aws-s3',
        providerOptions: {
          baseUrl: env('CDN_URL'), // Opcional: URL customizada
          rootPath: env('CDN_ROOT_PATH'), // Opcional: pasta raiz
          s3Options: {
            credentials: {
              accessKeyId: env('AWS_ACCESS_KEY_ID'),
              secretAccessKey: env('AWS_ACCESS_SECRET'),
            },
            region: env('AWS_REGION', 'us-east-1'),
            params: {
              ACL: env('AWS_ACL', 'public-read'),
              signedUrlExpires: env('AWS_SIGNED_URL_EXPIRES', 15 * 60),
              Bucket: env('AWS_BUCKET', 'car-hub-storage'), // Usar AWS_BUCKET como na doc
            },
          },
        },
        actionOptions: {
          upload: {},
          uploadStream: {},
          delete: {},
        },
      },
      sizeLimit: 10 * 1024 * 1024, // 10MB
      // DESABILITAR todas as otimizações locais para S3
      breakpoints: {}, // Sem breakpoints responsivos
      responsive: false, // Desabilita geração de múltiplos formatos
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
