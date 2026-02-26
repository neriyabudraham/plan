import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { config } from './config/index';
import { testConnection } from './db/pool';

// Routes
import authRoutes from './routes/auth';
import familyRoutes from './routes/family';
import familyShareRoutes from './routes/familyShare';
import childTemplatesRoutes from './routes/childTemplates';
import assetsRoutes from './routes/assets';
import goalsRoutes from './routes/goals';
import simulationRoutes from './routes/simulation';
import savingsPotsRoutes from './routes/savingsPots';

const app = express();

// Trust proxy (for nginx)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'יותר מדי בקשות, נסה שוב מאוחר יותר' },
  validate: { xForwardedForHeader: false },
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
app.use('/api/family', familyRoutes);
app.use('/api/family-share', familyShareRoutes);
app.use('/api/child-templates', childTemplatesRoutes);
app.use('/api/assets', assetsRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/simulation', simulationRoutes);
app.use('/api/savings-pots', savingsPotsRoutes);

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
const startServer = async () => {
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('❌ Failed to connect to database');
    process.exit(1);
  }
  console.log('✅ Database connected');
  
  app.listen(config.port, () => {
    console.log(`🚀 PlanIt server running on port ${config.port}`);
    console.log(`📊 Environment: ${config.nodeEnv}`);
  });
};

startServer();
