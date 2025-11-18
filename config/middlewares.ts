export default [
  'strapi::logger',
  'strapi::errors',
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'connect-src': ["'self'", 'https:'],
          'img-src': [
            "'self'",
            'data:',
            'blob:',
            'market-assets.strapi.io',
            'car-hub-storage.s3.us-east-1.amazonaws.com', // Bucket S3
          ],
          'media-src': [
            "'self'",
            'data:',
            'blob:',
            'market-assets.strapi.io',
            'car-hub-storage.s3.us-east-1.amazonaws.com', // Bucket S3
          ],
          upgradeInsecureRequests: null,
        },
      },
    },
  },
  {
    name: 'strapi::cors',
    config: {
      headers: ['Content-Type', 'Authorization', 'Origin', 'Accept', 'ngrok-skip-browser-warning'],
      origin: [
        'http://localhost:1337',
        'http://localhost:3000',
        'http://localhost:8081',
        'http://127.0.0.1:8081',
        /^exp:\/\/.*/, // Expo development URLs
        /^https?:\/\/.*\.exp\.direct:.*/, // Expo tunnel URLs
        /^https?:\/\/.*\.ngrok\.io$/, // ngrok URLs
        /^https?:\/\/.*\.ngrok-free\.app$/, // ngrok free URLs
        'https://b181d97b5f6f.ngrok-free.app', // Current ngrok URL
      ],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      credentials: true,
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  {
    name: 'strapi::body',
    config: {
      formLimit: '256mb',
      jsonLimit: '256mb',
      textLimit: '256mb',
      formidable: {
        maxFileSize: 10 * 1024 * 1024, // 10MB
      },
    },
  },
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
