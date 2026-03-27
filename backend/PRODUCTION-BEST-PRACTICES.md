# Production Best Practices Guide

This document outlines the production-ready improvements and best practices implemented in your restaurant POS backend.

## 🚀 Overview

Your backend has been enhanced with industry-standard practices including:
- **Structured Logging & Monitoring**
- **Enhanced Security & Authentication**
- **Performance Optimization**
- **Caching Strategies**
- **Background Job Processing**
- **Error Handling & Resilience**

## 🔧 Key Improvements Implemented

### 1. Database Optimizations
- **Optimized Indexes**: Added composite indexes for common query patterns
- **Query Performance**: Improved order listing, payment tracking, and employee performance queries
- **Connection Management**: Configurable connection pooling and timeouts

### 2. Security Enhancements
- **Enhanced Authentication**: JWT validation with security logging
- **Rate Limiting**: Configurable rate limits with lockout protection
- **Input Validation**: Comprehensive validation and sanitization layer
- **Branch Access Control**: Multi-tenant security with branch validation
- **Security Event Logging**: Track authentication failures and suspicious activities

### 3. Performance & Monitoring
- **Structured Logging**: Winston-based logging with multiple levels and outputs
- **Performance Monitoring**: Request tracking with slow endpoint alerts
- **Caching Layer**: In-memory caching with TTL and tag-based invalidation
- **Metrics Collection**: Prometheus-compatible metrics for monitoring

### 4. Background Processing
- **Job Queue**: Asynchronous job processing with retry logic
- **Common Jobs**: Email sending, notifications, report generation
- **Failure Handling**: Exponential backoff and max attempt limits

### 5. Error Handling
- **Centralized Error Handler**: Consistent error responses and logging
- **Error Context**: Request ID, user context, and metadata
- **Production Safety**: Error message sanitization for production

## 📋 Environment Configuration

### Required Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/pos_db
DB_MAX_CONNECTIONS=20
DB_CONNECTION_TIMEOUT=30000
DB_IDLE_TIMEOUT=10000

# Security
JWT_SECRET=your-super-secret-jwt-key
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
AUTH_COOKIE_SAMESITE=lax
BCRYPT_ROUNDS=12

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=300
AUTH_MAX_ATTEMPTS=5
AUTH_LOCKOUT_MS=900000

# Caching
CACHE_DEFAULT_TTL=300
CACHE_MAX_SIZE=10000
CACHE_CLEANUP_INTERVAL=300000

# Performance
SLOW_QUERY_THRESHOLD=1000
SLOW_REQUEST_THRESHOLD=3000
MAX_RESPONSE_SIZE=10485760

# Monitoring
METRICS_ENABLED=true
HEALTH_CHECK_INTERVAL=30000
ALERT_ERROR_RATE=0.05
ALERT_RESPONSE_TIME=5000
ALERT_MEMORY_USAGE=0.8

# Queue
QUEUE_CONCURRENCY=3
QUEUE_MAX_RETRIES=3
QUEUE_RETRY_DELAY=1000

# Logging
LOG_LEVEL=info
NODE_ENV=production
```

### Optional Environment Variables

```bash
# Email Configuration
EMAIL_SMTP_HOST=smtp.gmail.com
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=your-email@gmail.com
EMAIL_SMTP_PASS=your-app-password
EMAIL_FROM_ADDRESS=your-email@gmail.com

# WhatsApp (if configured)
WHATSAPP_API_KEY=your-whatsapp-api-key
RESTAURANT_PHONE=+1234567890

# CORS Configuration
CORS_ORIGIN=https://yourdomain.com
FRONTEND_URL=https://yourdomain.com
FRONTEND_CUSTOMER_URL=https://customers.yourdomain.com
FRONTEND_DASHBOARD_URL=https://dashboard.yourdomain.com
```

## 🚀 Deployment Guide

### 1. Database Migration
```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed data (if needed)
npm run seed
```

### 2. Build and Start
```bash
# Build the application
npm run build

# Start in production mode
npm start
```

### 3. Health Checks
- **Health Endpoint**: `GET /api/health`
- **Metrics**: `GET /api/metrics`
- **Performance**: `GET /api/performance`

## 🔍 Monitoring & Alerting

### Key Metrics to Monitor
1. **Error Rate**: Should be < 5%
2. **Response Time**: P95 should be < 5 seconds
3. **Memory Usage**: Should be < 80% of available memory
4. **Database Connections**: Monitor connection pool usage
5. **Queue Depth**: Monitor job queue backlog

### Log Analysis
- **Error Logs**: Check `logs/error.log`
- **Combined Logs**: Check `logs/combined.log`
- **Security Events**: Monitor for authentication failures
- **Performance**: Look for slow endpoint warnings

### Alerting Setup
Configure alerts for:
- High error rates (>5%)
- Slow response times (>5s P95)
- Memory usage (>80%)
- Authentication failures (brute force attempts)
- Database connection issues

## 🛡️ Security Best Practices

### 1. Authentication
- JWT tokens with short expiration (15 minutes)
- Refresh tokens with longer expiration (7 days)
- Secure cookie configuration
- Rate limiting on auth endpoints

### 2. Authorization
- Role-based access control (ADMIN/EMPLOYEE)
- Branch-level data isolation
- Endpoint-specific permissions

### 3. Input Validation
- Zod schema validation
- Input sanitization
- SQL injection prevention (Prisma)
- XSS prevention

### 4. Monitoring
- Security event logging
- Failed authentication tracking
- Cross-branch access attempt detection

## 📊 Performance Optimization

### 1. Caching Strategy
- **Menu Data**: 10 minutes TTL, branch-specific
- **Employee Metrics**: 5 minutes TTL, employee-specific
- **Performance Data**: 3 minutes TTL, branch-specific
- **Order Statistics**: 2 minutes TTL, branch-specific

### 2. Database Optimization
- Composite indexes for common queries
- Connection pooling (20 connections max)
- Query timeout (30 seconds)
- Idle connection timeout (10 seconds)

### 3. Background Jobs
- Asynchronous email sending
- WhatsApp notifications
- Report generation
- Data cleanup tasks

## 🔄 Scaling Considerations

### Horizontal Scaling
- **Load Balancer**: Configure sticky sessions for Socket.IO
- **Redis**: Replace in-memory cache with Redis for distributed caching
- **Database**: Use connection pooling and read replicas
- **Queue**: Use Redis-based queue (Bull Queue) for job processing

### Vertical Scaling
- **Memory**: Monitor and adjust heap size limits
- **CPU**: Optimize query performance and caching
- **I/O**: Use SSD storage for database

## 🧪 Testing

### Unit Tests
```bash
# Run unit tests
npm run test

# Run tests in watch mode
npm run test:watch
```

### Integration Tests
```bash
# Run integration tests
npm run test:integration
```

### Load Testing
```bash
# Run load tests
npm run loadtest:menu
npm run loadtest:order
npm run loadtest:mixed
```

## 🚨 Troubleshooting

### Common Issues

1. **Database Connection Issues**
   - Check DATABASE_URL configuration
   - Verify database server is running
   - Check connection pool settings

2. **High Memory Usage**
   - Monitor cache size
   - Check for memory leaks
   - Adjust heap size limits

3. **Slow Response Times**
   - Check database query performance
   - Monitor cache hit rates
   - Review background job queue

4. **Authentication Issues**
   - Verify JWT secret configuration
   - Check token expiration settings
   - Review rate limiting configuration

### Debug Mode
```bash
# Enable debug logging
LOG_LEVEL=debug npm start

# Enable performance monitoring
DEBUG_PERFORMANCE=true npm start
```

## 📈 Continuous Improvement

### Regular Tasks
1. **Log Rotation**: Configure log rotation for production
2. **Database Maintenance**: Regular vacuum and index rebuilds
3. **Security Updates**: Keep dependencies updated
4. **Performance Reviews**: Regular performance analysis
5. **Backup Testing**: Test restore procedures

### Monitoring Dashboard
Set up a dashboard to monitor:
- Application metrics
- Database performance
- Error rates
- Response times
- System resources

## 🆘 Support

For issues and questions:
1. Check the logs first (`logs/error.log`, `logs/combined.log`)
2. Review the troubleshooting section
3. Check the health endpoints (`/api/health`, `/api/metrics`)
4. Monitor the performance data (`/api/performance`)

---

## 🎯 Next Steps

1. **Set up monitoring dashboard** (Grafana/Prometheus)
2. **Configure alerting** (PagerDuty/Slack)
3. **Set up log aggregation** (ELK stack)
4. **Implement distributed tracing** (Jaeger/Zipkin)
5. **Add more comprehensive tests**
6. **Set up CI/CD pipeline**
