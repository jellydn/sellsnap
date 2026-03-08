# CONCERNS.md - Technical Debt & Concerns

## Overview
Documented technical concerns, areas for improvement, and potential issues in the SellSnap codebase.

---

## Priority Levels

| Level | Description |
|-------|-------------|
| 🔴 **Critical** | Security vulnerabilities, data loss risk |
| 🟡 **High** | Breaking bugs, performance issues |
| 🟢 **Medium** | Code quality, maintainability |
| ⚪ **Low** | Nice-to-have improvements |

---

## Security Concerns

### 🔴 Download Token Security
**Location**: `apps/server/src/routes/files.ts`

**Issue**: Download tokens (UUID) with 24h expiration may be insufficient for production:
- No rate limiting on download endpoint
- Tokens can be shared freely
- No IP binding or device tracking

**Recommendation**:
- Add rate limiting per token
- Consider shorter expiration (1-2 hours)
- Add IP binding to tokens
- Implement download attempt limits

### 🟡 File Upload Validation
**Location**: `apps/server/src/lib/upload.ts`

**Issue**: Basic file type validation may be insufficient:
- Only checks file extension/MIME type
- No virus scanning
- No file content validation (magic bytes)

**Recommendation**:
- Implement magic byte validation
- Add virus scanning for uploads
- Limit total storage per user
- Consider cloud storage with built-in security

### 🟢 Session Security
**Location**: `apps/server/src/lib/auth.ts`

**Issue**: Using database sessions; consider:
- Session fixation protection
- Concurrent session limits
- Session rotation on sensitive actions

**Current**: better-auth handles most concerns, but verify configuration.

---

## Performance Concerns

### 🟡 View Count Batching
**Location**: `apps/server/src/routes/files.ts`

**Issue**: In-memory view count queue:
- Lost on server restart
- Not scalable across multiple instances
- No persistence mechanism

**Current Implementation**:
```typescript
// In-memory queue, batched writes every 10s
const viewQueue = new Map<string, number>();
```

**Recommendation**:
- Move to Redis for distributed counting
- Or use database with proper batching
- Add graceful shutdown handling

### 🟢 No Caching Layer
**Issue**: No caching for frequently accessed data:
- Product listings hit database on every request
- User sessions queried repeatedly
- Static resources not cached aggressively

**Recommendation**:
- Add Redis cache for products
- Implement HTTP caching headers
- Consider CDN for static assets

### 🟢 Database Query Optimization
**Issue**: No evidence of query optimization:
- No explicit select statements (Prisma selects all fields)
- No query complexity analysis
- Potential N+1 queries in list endpoints

**Recommendation**:
- Audit Prisma queries with logging
- Add explicit selects where appropriate
- Index frequently queried fields

---

## Code Quality Concerns

### 🟢 Error Handling Consistency
**Location**: Various route files

**Issue**: Inconsistent error responses:
- Some routes return `{ error: "message" }`
- Others return `{ success: false, error: "message" }`
- HTTP status codes vary

**Recommendation**:
- Standardize error response format
- Create error handler middleware
- Document error codes

### 🟢 Type Safety Gaps
**Issue**: Some areas with weaker type safety:
- API request/response types may be incomplete
- Database query results not always typed
- Some `any` types may exist

**Recommendation**:
- Run `strict` TypeScript audit
- Add Zod schemas for API validation
- Improve type coverage

### 🟢 Test Coverage
**Issue**: Limited evidence of unit test coverage:
- E2E tests exist (10 files)
- Unit/integration tests not clearly visible

**Current**: ~367 test files reported, but coverage unclear

**Recommendation**:
- Run coverage report
- Identify untested critical paths
- Add unit tests for business logic

---

## Architecture Concerns

### 🟡 File Storage Scalability
**Location**: `apps/server/public/uploads/`

**Issue**: Local file storage not production-ready:
- Doesn't scale across instances
- No backup strategy
- No CDN integration
- Limited disk space

**Recommendation**:
- Migrate to cloud storage (S3, R2, Backblaze)
- Implement CDN for downloads
- Add backup/redundancy strategy

### 🟢 Email Not Implemented
**Location**: `apps/server/src/lib/email.ts` (placeholder)

**Issue**: Email functionality referenced but not implemented:
- Password reset flows
- Purchase confirmations
- Download notifications

**Status**: Placeholder exists, implementation needed

**Recommendation**:
- Choose email provider (SendGrid, Resend, AWS SES)
- Implement email templates
- Add queue for reliable delivery

### 🟢 No Background Job System
**Issue**: No async job processing:
- Email sending (when implemented) will block requests
- No job queue for heavy tasks
- No retry mechanism for failures

**Recommendation**:
- Add job queue (BullMQ, Faktory)
- Move heavy tasks to background
- Implement retry logic

---

## Missing Features

### 🟢 User Management
**Observations**:
- No user profile editing
- No password reset flow (UI)
- No email verification
- No account deletion

### 🟢 Admin Features
**Observations**:
- No admin dashboard
- No sales reporting
- No user management interface
- No product moderation

### 🟢 Analytics
**Observations**:
- No usage analytics
- No sales metrics
- No user behavior tracking

---

## Configuration Concerns

### 🟢 Environment Variable Validation
**Issue**: No validation that required env vars are set:
- App may start with missing configuration
- Runtime errors when accessing undefined env vars
- No clear error messages for misconfiguration

**Recommendation**:
- Add env var validation on startup
- Use Zod for env schema validation
- Provide helpful error messages

### 🟢 Hardcoded Values
**Issue**: Some values may be hardcoded:
- Rate limit values
- File size limits
- Token expiration times

**Recommendation**:
- Move to environment variables
- Document configuration options
- Add validation

---

## Deployment Concerns

### 🟢 Production Readiness
**Observations**:
- No evidence of production deployment config
- No database migration strategy documented
- No health check endpoints
- No logging/metrics setup

**Recommendation**:
- Add `/health` endpoint
- Implement structured logging
- Add metrics collection
- Document deployment process

### 🟢 Docker Configuration
**Issue**: Only `docker-compose.yml` for local PostgreSQL:
- No containerized app deployment
- No production Docker setup

**Recommendation**:
- Add Dockerfile for apps
- Create production compose file
- Document container deployment

---

## Documentation Concerns

### 🟢 API Documentation
**Issue**: No API documentation:
- No OpenAPI/Swagger spec
- No request/response examples
- No authentication documentation

**Recommendation**:
- Add OpenAPI spec
- Generate API docs
- Document authentication flow

### 🟢 Developer Guide
**Issue**: Limited onboarding documentation:
- No architecture decision records (ADRs)
- No contribution guidelines
- Limited code comments

**Recommendation**:
- Add ADRs for major decisions
- Create contributing guide
- Document complex logic

---

## Dependency Concerns

### 🟢 Dependency Updates
**Issue**: No automated dependency updates:
- Security vulnerabilities may go unnoticed
- Missing out on bug fixes
- Potential compatibility issues

**Recommendation**:
- Add Dependabot or Renovate
- Regular security audits
- Document upgrade process

---

## Monitoring & Observability

### 🟢 No Logging Strategy
**Issue**: Minimal logging implementation:
- `packages/logger/` is minimal
- No structured logging
- No log levels configured

**Recommendation**:
- Implement structured logging (Pino, Winston)
- Add request logging middleware
- Set up log aggregation

### 🟢 No Error Tracking
**Issue**: No error tracking system:
- Production errors may go unnoticed
- No stack trace collection
- No alerting

**Recommendation**:
- Add Sentry or similar
- Implement error reporting
- Set up alerting

---

## Testing Gaps

### 🟢 Missing Test Scenarios
**Observations**:
- No evidence of load testing
- No security testing
- Limited edge case coverage

**Recommendation**:
- Add load testing (k6)
- Implement security test suite
- Increase edge case coverage

---

## Summary Statistics

| Category | Count |
|----------|-------|
| 🔴 Critical | 3 |
| 🟡 High | 5 |
| 🟢 Medium | 20+ |
| ⚪ Low | Not counted |

---

## Recommended Next Steps

1. **Immediate** (This Sprint):
   - Add download token rate limiting
   - Implement file upload validation
   - Add env var validation

2. **Short-term** (This Month):
   - Migrate to cloud storage
   - Implement email system
   - Add comprehensive tests

3. **Long-term** (This Quarter):
   - Add caching layer
   - Implement background jobs
   - Set up monitoring/alerting

---

## Notes

- This document should be updated as concerns are addressed
- Prioritize based on actual user impact
- Re-evaluate after production deployment
