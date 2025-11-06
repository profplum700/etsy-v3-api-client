# Performance Testing

This directory contains performance and load testing suites.

## Running Performance Tests

```bash
npm run test:performance
```

## Benchmarks

### API Response Times
- `getShop()` - Target: < 100ms
- `getListings()` - Target: < 200ms
- Concurrent requests - Target: 50+ req/s

### Pagination
- 250 items across 3 pages - Target: < 1000ms

### Caching
- First request: Normal latency
- Cached request: < 10ms

### Rate Limiting
- Should throttle to configured limit
- No dropped requests

### Memory
- 100 requests: < 10MB increase
- No memory leaks

## Load Testing

Run with different concurrency levels:

```bash
CONCURRENCY=10 npm run test:performance
CONCURRENCY=50 npm run test:performance
CONCURRENCY=100 npm run test:performance
```

## Profiling

To profile performance:

```bash
node --prof index.js
node --prof-process isolate-*.log > profile.txt
```

## Optimization Tips

1. Enable caching for frequently accessed data
2. Use pagination efficiently
3. Batch requests when possible
4. Monitor rate limits
5. Use connection pooling
