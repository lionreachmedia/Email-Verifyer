const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { env } = require('./config/env');
const limits = require('./middleware/rateLimits');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errors');

const app = express();
if (env.trustProxy) app.set('trust proxy', env.trustProxy);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
    },
  },
}));
app.use(cors({ origin: env.clientUrl.split(',').map((s) => s.trim()), credentials: true }));
app.use(express.json({ limit: '100kb' }));
if (!env.isProd) app.use(morgan('dev'));

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
app.use('/api', limits.api, routes);
app.use('/api', notFound);

// Production: serve the built React app from the same server.
const dist = path.resolve(__dirname, '../../client/dist');
if (env.serveClient && fs.existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: '7d' }));
  app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
