import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import publicAuth from './routes/publicAuth.js';
import auth from './routes/auth.js';

const app = express();

// Trust reverse proxy (for correct IPs when behind Nginx/Cloudflare)
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // keep simple for API-only; serve UI separately
}));

// Logging
app.use(morgan('combined'));

// JSON body
app.use(express.json({ limit: '1mb' }));

// Cookies
app.use(cookieParser());

// CORS for frontend origin with credentials
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
app.use(cors({
  origin: FRONTEND_ORIGIN,
  credentials: true,
}));

// Health
app.get('/health', (req, res) => res.json({ ok: true }));

// Routes
app.use('/api/public', publicAuth);
app.use('/api/auth', auth);

// 404
app.use((req, res) => res.status(404).json({ message: 'Not Found' }));

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal Server Error' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 GeniusGrid backend running on port ${port}`);
});
