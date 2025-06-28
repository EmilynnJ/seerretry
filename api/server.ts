import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "../server/routes.js";
import { setupVite, serveStatic, log } from "../server/vite.js";
import { initializeDatabase } from "../server/migrations/migration-manager.js";
import { config } from "dotenv";
import path from "path";
import cors from "cors";

// Load environment variables
config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Configure CORS based on environment
const corsOptions = {
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With']
};
app.use(cors(corsOptions));

// Serve uploads directory directly
const uploadsPath = path.join(process.cwd(), 'public', 'uploads');
const imagesPath = path.join(process.cwd(), 'public', 'images');

app.use('/uploads', express.static(uploadsPath));
app.use('/images', express.static(imagesPath));

// Add health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.VITE_APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV
  });
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Initialize database and register routes
(async () => {
  const MAX_RETRIES = 5;
  const RETRY_DELAY = 5000;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await initializeDatabase();
      log('Database initialized successfully', 'database');
      break;
    } catch (error) {
      log(`Database initialization attempt ${attempt} failed: ${error}`, 'database');
      
      if (attempt === MAX_RETRIES) {
        log('All database initialization attempts failed. Exiting.', 'database');
        process.exit(1);
      }
      
      log(`Retrying in ${RETRY_DELAY/1000} seconds...`, 'database');
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }
  
  await registerRoutes(app);
  
  // Initialize services
  try {
    const { webRTCService } = await import('../server/services/webrtc-service');
    console.log('WebRTC service initialized successfully');
  } catch (error) {
    console.error('Failed to initialize WebRTC service:', error);
  }
  
  try {
    const { livestreamService } = await import('../server/services/livestream-service');
    console.log('Livestream service initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Livestream service:', error);
  }

  // Initialize payout scheduler
  try {
    const { readerBalanceService } = await import('../server/services/reader-balance-service');
    console.log('Reader balance service initialized');
  } catch (error) {
    console.error('Failed to initialize reader balance service:', error);
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Server error:", err);
    res.status(status).json({ message });
  });

  // Serve static files in production
  if (app.get("env") === "production") {
    serveStatic(app);
  }

  console.log('Server initialized successfully');
})();

// Export for Vercel
export default app; 