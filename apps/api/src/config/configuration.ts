export default () => ({
  // Server
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/whatsapp_crm',
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    tls: process.env.REDIS_TLS === 'true',
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    refreshSecret:
      process.env.JWT_REFRESH_SECRET || 'super-secret-refresh-key-change-in-production',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },

  // Evolution API
  evolutionApi: {
    url: process.env.EVOLUTION_API_URL || 'http://localhost:8080',
    apiKey: process.env.EVOLUTION_API_KEY || '',
  },

  // MinIO (S3-compatible storage)
  storage: {
    endpoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000', 10),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    bucket: process.env.MINIO_BUCKET || 'whatsapp-crm',
  },

  // Rate Limiting
  rateLimit: {
    ttl: parseInt(process.env.RATE_LIMIT_TTL || '60000', 10),
    limit: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },

  // Encryption
  encryption: {
    key: process.env.ENCRYPTION_KEY || 'change-this-32-character-secret!',
  },
});
