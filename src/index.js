import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import openAiRoutes from './routes/openAi.js';
import authRoutes from './routes/auth.js';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import cookieParser from 'cookie-parser';
import requireRecaptcha from './middleware/requireRecaptcha.js';

// --------------------------------------
// Load environment variables
// --------------------------------------
const isProduction = process.env.NODE_ENV === 'production';

// Only load .env file when NOT in production.
// Render provides env vars automatically.
if (!isProduction) {
  dotenv.config({ path: '.env.development' });
  console.log('Loaded .env.development');
} else {
  console.log('Running in production (Render), env vars come from Render dashboard.');
}

const app = express();
app.set('trust proxy', 1);

// --------------------------------------
// Config / Env Vars
// --------------------------------------
const PORT = process.env.PORT || 3000;
const API_PREFIX = '/api';

const allowedOrigins = [
  'http://localhost:9000',
  'https://glkfreelance.com',
  'https://www.glkfreelance.com',
];

// --------------------------------------
// Middleware
// --------------------------------------
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(express.json());
app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser / server-to-server requests (no Origin header)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      console.warn('Blocked CORS origin:', origin);
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT'],
    allowedHeaders: [
      'Content-Type',
      'X-Forwarded-For',
      'X-Requested-With',
      'Authorization',
      'X-Recaptcha-Token',
    ],
    credentials: true, // allow cookies, auth headers
  })
);

// --------------------------------------
// Rate Limiting / Slowdown
// --------------------------------------
const ipLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  ipv6Subnet: 56,
});

const rateLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 10,
  delayMs: (hits) => hits * 100,
});

// --------------------------------------
// Routes
// --------------------------------------
const api = express.Router();

api.use('/auth', authRoutes);
api.use('/openAi', requireRecaptcha, ipLimiter, rateLimiter, openAiRoutes);

app.use(API_PREFIX, api);

// --------------------------------------
// Start Server
// --------------------------------------
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
