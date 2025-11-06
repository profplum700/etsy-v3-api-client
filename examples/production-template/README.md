# Production Template

A production-ready template with best practices for deploying Etsy integrations.

## Features

- Environment-based configuration
- Encrypted token storage
- Comprehensive error handling
- Logging and monitoring
- Rate limiting
- Caching strategy
- Health checks
- Docker support
- CI/CD ready

## Project Structure

```
production-template/
├── src/
│   ├── config/          # Configuration management
│   ├── services/        # Business logic
│   ├── middleware/      # Express middleware
│   ├── routes/          # API routes
│   └── utils/           # Utilities
├── tests/               # Test suite
├── docker/              # Docker configuration
├── .env.example         # Environment template
├── Dockerfile
└── docker-compose.yml
```

## Setup

1. Copy environment template:
```bash
cp .env.example .env
```

2. Configure variables:
```env
# Etsy API
ETSY_API_KEY=your_key
ETSY_SHOP_ID=your_shop_id
REDIRECT_URI=https://yourdomain.com/callback

# Security
ENCRYPTION_KEY=32_byte_key_here
SESSION_SECRET=random_secret
WEBHOOK_SECRET=webhook_secret

# Database
DATABASE_URL=postgresql://user:pass@localhost/db

# Redis
REDIS_URL=redis://localhost:6379

# Monitoring
SENTRY_DSN=your_sentry_dsn
```

3. Install dependencies:
```bash
npm install
```

4. Run database migrations:
```bash
npm run db:migrate
```

5. Start application:
```bash
npm run dev        # Development
npm run build      # Production build
npm start          # Production
```

## Docker Deployment

```bash
docker-compose up -d
```

## Environment Variables

### Required
- `ETSY_API_KEY` - Your Etsy API key
- `ENCRYPTION_KEY` - 32-byte encryption key for tokens
- `DATABASE_URL` - PostgreSQL connection string

### Optional
- `REDIS_URL` - Redis for caching
- `SENTRY_DSN` - Error monitoring
- `LOG_LEVEL` - Logging level (debug, info, warn, error)
- `PORT` - Server port (default: 3000)

## Security Best Practices

### Token Storage
```typescript
import { EncryptedFileTokenStorage } from '@profplum700/etsy-v3-api-client';

const storage = new EncryptedFileTokenStorage(
  './tokens.enc',
  process.env.ENCRYPTION_KEY
);
```

### Rate Limiting
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

app.use('/api/', limiter);
```

### Helmet Security
```typescript
import helmet from 'helmet';
app.use(helmet());
```

## Monitoring

### Health Check
```
GET /health
```

Returns:
```json
{
  "status": "ok",
  "timestamp": "2025-01-06T12:00:00Z",
  "services": {
    "database": "ok",
    "redis": "ok",
    "etsy": "ok"
  }
}
```

### Metrics
```
GET /metrics
```

Prometheus-format metrics for:
- Request count
- Response times
- Error rates
- API call count

## Error Handling

```typescript
import { EtsyApiError } from '@profplum700/etsy-v3-api-client';
import * as Sentry from '@sentry/node';

app.use((error, req, res, next) => {
  // Log to Sentry
  Sentry.captureException(error);

  // Custom error handling
  if (error instanceof EtsyApiError) {
    return res.status(error.statusCode).json({
      error: error.message
    });
  }

  res.status(500).json({ error: 'Internal server error' });
});
```

## Testing

```bash
npm test              # Run tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

## CI/CD

### GitHub Actions

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run tests
        run: npm test
      - name: Deploy
        run: npm run deploy
```

## Deployment Checklist

- [ ] Set all environment variables
- [ ] Configure encryption key
- [ ] Set up database
- [ ] Configure Redis (optional)
- [ ] Set up SSL certificates
- [ ] Configure webhook URL in Etsy
- [ ] Set up monitoring (Sentry, etc.)
- [ ] Configure backups
- [ ] Set up logging aggregation
- [ ] Load test the application
- [ ] Document runbooks

## Scaling Considerations

### Horizontal Scaling
- Use Redis for session storage
- Use database for token storage
- Load balancer for multiple instances

### Caching Strategy
```typescript
const client = new EtsyClient({
  apiKey: process.env.ETSY_API_KEY!,
  redirectUri: process.env.REDIRECT_URI!,
  scopes: ['listings_r', 'shops_r'],
  cache: {
    enabled: true,
    ttl: 300000 // 5 minutes
  }
});
```

### Background Jobs
Use Bull for job processing:
```typescript
import Queue from 'bull';

const fulfillmentQueue = new Queue('fulfillment', {
  redis: process.env.REDIS_URL
});

fulfillmentQueue.process(async (job) => {
  await processOrder(job.data);
});
```

## Maintenance

### Backup Tokens
```bash
npm run backup:tokens
```

### Rotate Encryption Key
```bash
npm run rotate:encryption-key
```

### Update Dependencies
```bash
npm audit
npm update
```

## Support

- Documentation: `/docs`
- Issues: GitHub Issues
- Security: security@example.com
