# Codebase Concerns

**Analysis Date:** 2026-03-05

## Tech Debt

**Monolithic Server File:**
- Issue: All server code in single 935-line file (`apps/server/src/index.ts`)
- Files: `apps/server/src/index.ts`
- Impact: Difficult to navigate, maintain, and test; violates single responsibility principle
- Fix approach: Split into route modules by feature (auth, products, purchases, webhooks)

**No Input Validation Library:**
- Issue: Manual validation scattered across route handlers
- Files: `apps/server/src/index.ts` (all route handlers)
- Impact: Inconsistent validation, potential security gaps, duplicated code
- Fix approach: Integrate validation library (Zod, Joi) for schema validation

**Development-Only Email Logging:**
- Issue: Emails logged to console instead of sent in production
- Files: `apps/server/src/index.ts` (line ~238: `console.log` for purchase email)
- Impact: Users don't receive purchase confirmations or download links
- Fix approach: Integrate email service (Resend, SendGrid, AWS SES)

**No Image CDN/Optimization:**
- Issue: Product images stored locally and served without optimization
- Files: `apps/server/src/index.ts` (file upload handling)
- Impact: Slow image delivery, no responsive variants, storage costs at scale
- Fix approach: Integrate image CDN (Cloudinary, Vercel Blob, AWS S3 + CloudFront)

## Known Bugs

**Product Slug Race Condition:**
- Symptoms: Multiple products with same slug could be created
- Files: `apps/server/src/index.ts` (product creation endpoint)
- Trigger: Two simultaneous product creations with same name
- Workaround: None (slugify is deterministic, no unique check)
- Risk: Database unique constraint would fail, causing 500 error for one request

**Dashboard Async Race Condition:**
- Symptoms: Analytics and products fetch simultaneously, no coordination
- Files: `apps/web/src/pages/Dashboard.tsx`
- Trigger: Loading dashboard page
- Workaround: None (works but inefficient)
- Risk: Unnecessary server load, no loading state coordination

**View Count Race Condition:**
- Symptoms: View counts incremented without database locking
- Files: `apps/server/src/index.ts` (product view endpoint)
- Trigger: Concurrent page views
- Workaround: None
- Risk: Lost updates at high traffic

## Security Considerations

**CORS Origin Wide Open:**
- Risk: Any origin can make requests to API
- Files: `apps/server/src/index.ts` (line ~32: `origin: true`)
- Current mitigation: None (allows all origins)
- Recommendations: Set explicit allowed origins for production

**No Content-Type Validation on Uploads:**
- Risk: Any file type can be uploaded
- Files: `apps/server/src/index.ts` (multipart upload handler)
- Current mitigation: None
- Recommendations: Validate MIME types, file extensions, and file sizes

**Large File Upload Limit:**
- Risk: 100MB upload limit could enable DoS attacks
- Files: `apps/server/src/index.ts` (multipart config)
- Current mitigation: Rate limiting present but generous
- Recommendations: Lower limit to ~10MB for product images, implement chunking

**No Rate Limiting on Public Endpoints:**
- Risk: Public endpoints could be abused
- Files: `apps/server/src/index.ts` (product listing, product detail endpoints)
- Current mitigation: None for public routes
- Recommendations: Add rate limiting to all public endpoints

**Download Link Without CSRF Protection:**
- Risk: Download tokens could be leaked via XSS
- Files: `apps/web/src/pages/PurchaseSuccess.tsx`, `apps/server/src/index.ts` (download endpoint)
- Current mitigation: Token expiration (24 hours)
- Recommendations: Add CSRF tokens for download link generation

## Performance Bottlenecks

**Single File Server:**
- Problem: 935-line file loaded into memory
- Files: `apps/server/src/index.ts`
- Cause: Monolithic architecture
- Improvement path: Split into modules, lazy load routes

**No Query Result Caching:**
- Problem: Every request hits database
- Files: `apps/web/src/lib/api.ts` (React Query not configured with cache time)
- Cause: No cache configuration
- Improvement path: Configure React Query staleTime/cacheTime, add Redis caching

**Unoptimized Image Delivery:**
- Problem: Images served at full size, no responsive variants
- Files: `apps/server/src/index.ts` (static file serving)
- Cause: No image optimization pipeline
- Improvement path: Integrate image CDN with on-the-fly optimization

## Fragile Areas

**Session Management (better-auth integration):**
- Files: `apps/web/src/lib/auth.ts`, `apps/server/src/index.ts`
- Why fragile: Complex auth flow, minimal error handling
- Safe modification: Test thoroughly with various auth states
- Test coverage: Zero tests for auth flows

**Payment Flow:**
- Files: `apps/server/src/index.ts` (checkout, webhook, purchase endpoints)
- Why fragile: Money-handling code, webhook signature verification critical
- Safe modification: Always test with Stripe test mode, verify webhook signatures
- Test coverage: Zero tests for payment flows

**File Upload Handling:**
- Files: `apps/server/src/index.ts` (multipart upload)
- Why fragile: File operations can fail, disk space issues
- Safe modification: Add comprehensive error handling, file cleanup
- Test coverage: Zero tests for upload functionality

## Scaling Limits

**File Storage:**
- Current capacity: Server local filesystem
- Limit: Server disk space, no replication
- Scaling path: Move to object storage (S3, Vercel Blob)

**Database:**
- Current capacity: Single PostgreSQL instance
- Limit: Dependent on database instance size
- scaling path: Connection pooling, read replicas, caching

**Server Process:**
- Current capacity: Single Fastify process
- Limit: Single CPU core utilization
- Scaling path: Cluster mode (Node.js), containerization, load balancer

## Dependencies at Risk

**better-auth 1.1.1:**
- Risk: New library, potential breaking changes in minor versions
- Impact: Authentication would break
- Migration plan: Pin to minor versions, watch changelog, test upgrades

**Stripe 17.6.0:**
- Risk: Frequent API updates
- Impact: Payment processing would fail
- Migration plan: Test webhook handling after upgrades, monitor Stripe changelog

## Missing Critical Features

**Email Service Integration:**
- Problem: No emails sent in production
- Blocks: Purchase confirmations, password resets, download delivery
- Priority: High (users expect email confirmations)

**Image Upload/Management:**
- Problem: Basic file upload, no image optimization or CDN
- Blocks: Scalability, user experience
- Priority: Medium

**User Email Verification:**
- Problem: No email verification required
- Blocks: Account security, deliverability
- Priority: Medium

**Analytics Tracking:**
- Problem: No analytics beyond basic view counts
- Blocks: Business insights, user behavior understanding
- Priority: Low

## Test Coverage Gaps

**Entire Codebase:**
- What's not tested: All functionality
- Files: All `.ts` and `.tsx` files
- Risk: Any change could break functionality undetected
- Priority: Critical

**Authentication Flow:**
- What's not tested: Sign up, sign in, sign out, protected routes
- Files: `apps/web/src/lib/auth.ts`, `apps/server/src/index.ts` (auth endpoints)
- Risk: Security vulnerabilities, broken auth
- Priority: Critical

**Payment Flow:**
- What's not tested: Checkout creation, webhook handling, purchase recording
- Files: `apps/server/src/index.ts` (checkout, webhook, purchase endpoints)
- Risk: Lost revenue, incorrect purchase tracking
- Priority: Critical

**API Endpoints:**
- What's not tested: All REST endpoints
- Files: `apps/server/src/index.ts`
- Risk: API regressions, breaking changes
- Priority: High

**Components:**
- What's not tested: All React components
- Files: `apps/web/src/components/*`, `apps/web/src/pages/*`
- Risk: UI regressions, broken user flows
- Priority: Medium

---

*Concerns audit: 2026-03-05*

**Summary:** This is an MVP with significant technical debt and zero test coverage. The most critical concerns are the lack of tests (especially for auth and payments), missing email integration, and security gaps in the production deployment.
