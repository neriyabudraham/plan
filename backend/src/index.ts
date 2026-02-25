import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/index.js';

// Routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import fundRoutes from './routes/funds.js';
import transactionRoutes from './routes/transactions.js';
import whatsappRoutes from './routes/whatsapp.js';
import dashboardRoutes from './routes/dashboard.js';
import recurringRoutes from './routes/recurring.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'יותר מדי בקשות, נסה שוב מאוחר יותר' },
});

app.use('/api/', limiter);

// CORS
app.use(cors({
  origin: config.nodeEnv === 'production' 
    ? config.app.url 
    : ['http://localhost:5173', 'http://localhost:3955'],
  credentials: true,
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/funds', fundRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/recurring', recurringRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve static files in production
if (config.nodeEnv === 'production') {
  const publicPath = path.join(__dirname, '..', 'public');
  app.use(express.static(publicPath));
  
  // SPA fallback
  app.get('*', (_req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'שגיאת שרת פנימית' });
});

// Start server
app.listen(config.port, () => {
  console.log(`🚀 PlanIt server running on port ${config.port}`);
  console.log(`📊 Environment: ${config.nodeEnv}`);
});
