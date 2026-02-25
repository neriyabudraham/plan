import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3955'),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  db: {
    connectionString: process.env.DATABASE_URL || 
      `postgresql://planit:${process.env.DB_PASSWORD}@localhost:5432/planit`,
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production',
    expiresIn: '15m',
    refreshExpiresIn: '7d',
  },
  
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackUrl: `${process.env.APP_URL || 'http://localhost:3955'}/api/auth/google/callback`,
  },
  
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  
  app: {
    url: process.env.APP_URL || 'http://localhost:3955',
    adminEmail: process.env.ADMIN_EMAIL || 'admin@example.com',
  },
  
  whatsapp: {
    apiUrl: process.env.WHATSAPP_API_URL || 'https://bot.botomat.co.il/api',
  },
};
