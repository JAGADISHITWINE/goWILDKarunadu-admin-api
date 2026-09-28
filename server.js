require('dotenv').config();

const express = require('express');
const app = express();

const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const rbacService = require('./src/service/rbac.service');
const couponService = require('./src/service/coupon.service');
const auditService = require('./src/service/audit.service');
const staticPagesService = require('./src/service/staticPages.service');
const completionService = require('./src/service/completion.service');

const publicRoutes = require('./src/routes/public.routes');
const authRoutes = require('./src/routes/common.routes');

/* =================================
   CORS CONFIG (MUST BE FIRST)
================================= */

const defaultAllowedOrigins = [
  'http://localhost:4200',
  'http://localhost:4600',
  'http://localhost:4700',
  'http://localhost:8100',
  'http://127.0.0.1:4200',
  'http://127.0.0.1:4600',
  'http://127.0.0.1:4700',
  'http://127.0.0.1:8100',
  'https://gowildkarunadu.online',
  'https://www.gowildkarunadu.online',
  'https://admin.gowildkarunadu.online',
  'https://gowildkarunadu.com',
  'https://www.gowildkarunadu.com',
  'https://admin.gowildkarunadu.com',
];

const allowedOrigins = Array.from(
  new Set(
    [
      ...(process.env.CORS_ORIGINS || '').split(','),
      ...defaultAllowedOrigins,
      'https://cdn.jsdelivr.net',
    ]
      .map((origin) => origin.trim())
      .filter(Boolean)
  )
);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Payload-Encrypted',
      'X-Skip-Encryption',
      'Accept',
      'Origin',
      'X-Requested-With',
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    exposedHeaders: ['Set-Cookie', 'X-Payload-Encrypted', 'X-Skip-Encryption', 'Retry-After']
  })
);

/* =================================
   SECURITY MIDDLEWARE
================================= */

// Hide x-powered-by
app.disable('x-powered-by');

// Respect reverse proxy IPs (required for accurate limiter keys behind Nginx/Cloudflare)
app.set('trust proxy', 1);

// Helmet (important for images/uploads)
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],

        "img-src": [
          "'self'",
          "data:",
          "http://localhost:4001",
          "http://127.0.0.1:4001",
          "https://images.gowildkarunadu.online",
          "https://admin-api.gowildkarunadu.online"
        ],

        "connect-src": [
          "'self'",
          "http://localhost:4001",
          "http://127.0.0.1:4001",
          "https://images.gowildkarunadu.online",
          "https://admin-api.gowildkarunadu.online"
        ],

        "script-src": [
          "'self'",
          "https://cdn.jsdelivr.net"
        ],

        "style-src": [
          "'self'",
          "https://cdn.jsdelivr.net",
          "'unsafe-inline'"
        ]
      }
    }
  })
);

// Global rate limiting (base protection, relaxed for admin UI traffic)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1500,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
  handler: (req, res) => {
    res.set('Retry-After', String(Math.ceil((15 * 60 * 1000) / 1000)));
    return res.status(429).json({
      success: false,
      message: 'Too many requests. Please retry shortly.'
    });
  }
});
app.use(limiter);

const adminReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method !== 'GET',
  handler: (req, res) => {
    res.set('Retry-After', '60');
    return res.status(429).json({
      success: false,
      message: 'Dashboard rate limit reached. Please retry in a moment.'
    });
  }
});

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const { encryptionMiddleware } = require('./src/middleware/encryption.middleware');
app.use(encryptionMiddleware);

/* =================================
   ROUTES
================================= */

app.use('/api/content', publicRoutes);
app.use('/api/auth', authRoutes);

app.get('/', (req, res) => {
  res.send('Server running...');
});

/* =================================
   STATIC UPLOADS
================================= */

const sharedUploadsRoot = process.env.SHARED_UPLOADS_DIR
  ? path.resolve(process.env.SHARED_UPLOADS_DIR)
  : path.resolve(__dirname, 'uploads');
app.use('/uploads', express.static(sharedUploadsRoot));

/* =================================
   START SERVER
================================= */

const logger = require('./src/utils/logger');
const PORT = process.env.PORT || 4001;

rbacService.ensureRbacSchema().catch((error) => {
  logger.error('Failed to initialize RBAC schema:', error);
});
couponService.ensureCouponSchema().catch((error) => {
  logger.error('Failed to initialize Coupon schema:', error);
});
auditService.ensureAuditSchema().catch((error) => {
  logger.error('Failed to initialize Audit schema:', error);
});
staticPagesService.ensureStaticPagesSchema().catch((error) => {
  logger.error('Failed to initialize Static Pages schema:', error);
});
completionService.startAutoCompletionScheduler(30);

const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`goWILD Admin API server listening on port ${PORT}`);
});
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

process.on('unhandledRejection', (reason) => {
  logger.error('Admin API Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Admin API Uncaught Exception:', error);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received: closing Admin API HTTP server gracefully');
  server.close(() => {
    logger.info('Admin API server closed');
    process.exit(0);
  });
});

