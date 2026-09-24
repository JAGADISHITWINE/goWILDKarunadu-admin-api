const express = require("express");
const cors = require("cors");

const app = express();

app.disable('x-powered-by');

const defaultAllowedOrigins = [
  'http://localhost:4200',
  'http://localhost:4600',
  'http://localhost:4700',
  'http://localhost:8100',
  'http://127.0.0.1:4200',
  'http://127.0.0.1:4600',
  'http://127.0.0.1:4700',
  'http://127.0.0.1:8100',
  'https://gowildkarunadu-admin.vercel.app',
];

const allowedOrigins = Array.from(
  new Set(
    [
      ...(process.env.CORS_ORIGINS || '').split(','),
      ...defaultAllowedOrigins,
    ]
      .map((origin) => origin.trim())
      .filter(Boolean)
  )
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.send("API running 🚀");
});

module.exports = app;
