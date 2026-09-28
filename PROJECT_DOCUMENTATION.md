# GoWILD Karunadu Project Documentation

This document covers the API and UI modules for both the admin and user-facing apps in the GoWILD Karunadu project.

---

## 1. Project Structure

```text
goWILDKarunadu/
├── goWILDKarunadu-admin-api/
│   ├── app.js
│   ├── server.js
│   ├── src/
│   ├── uploads/
│   └── .env
├── goWILDKarunadu-admin-ui/
│   ├── src/
│   ├── angular.json
│   └── package.json
├── goWILDKarunadu-user-api/
│   ├── app.js
│   ├── src/
│   ├── uploads/
│   └── .env
├── goWILDKarunadu-user-ui/
│   ├── src/
│   ├── angular.json
│   └── package.json
└── shared-uploads/
```

### Purpose of each app

| App | Type | Main purpose |
|---|---|---|
| admin-api | Backend | Admin dashboard operations, content management, analytics, user management |
| admin-ui | Frontend | Staff/admin portal for managing treks, content, bookings, users, reviews, analytics |
| user-api | Backend | Public-facing user flows: auth, booking, treks, referrals, blog |
| user-ui | Frontend | Customer portal for browsing trips, booking, blog, account, referrals |

---

## 2. Admin API Overview

### Base setup

- App entry: `goWILDKarunadu-admin-api/app.js`
- Server boot: `goWILDKarunadu-admin-api/server.js`
- Route definitions: `goWILDKarunadu-admin-api/src/routes/common.routes.js`
- Public/content routes: `goWILDKarunadu-admin-api/src/routes/public.routes.js`

### Admin API authentication model

- JWT-based auth middleware is applied globally after login routes.
- Some endpoints are protected by permission checks via `requirePermission`.
- The admin system uses roles and RBAC permissions.

### Admin API endpoint categories

#### 2.1 Authentication

| Method | Endpoint | Purpose |
|---|---|---|
| POST | /login | Admin login |
| POST | /logout | Admin logout |
| GET | /me | Logged-in admin details |
| GET | /dashData | Dashboard summary data |

#### 2.2 Users and admin management

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /getUsers | Fetch all users |
| GET | /user/:userid/getUserById | Fetch user detail |
| GET | /rbac/table | Show RBAC table |
| PUT | /rbac/table | Update RBAC permissions |
| POST | /admins | Create admin with role |
| GET | /audit-logs | View audit events |

#### 2.3 Trek management

| Method | Endpoint | Purpose |
|---|---|---|
| POST | /createTrek | Create new trek with cover/gallery images |
| GET | /getAllTreks | Fetch list of treks |
| GET | /getTrekById/:id | View one trek |
| GET | /getTrekByIdToUpdate/:id | Fetch trek for editing |
| GET | /treks/:trekId/batches | Fetch trek batches |
| GET | /batches/:batchId/bookings | Fetch bookings in a batch |
| PATCH | /batches/:batchId/stop-booking | Stop booking for a batch |
| PATCH | /batches/:batchId/resume-booking | Resume booking for a batch |
| GET | /batches/:batchId/export-bookings | Export bookings for a batch |
| GET | /treks/:trekId/export-all-bookings | Export all trek bookings |
| GET | /treks | Fetch short trek list |
| POST | /treks/:id | Update trek |

#### 2.4 Analytics and booking operations

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /revenue | Fetch all revenue data |
| GET | /bookingData | Fetch booking analytics |
| GET | /bookings/completion-stats | Booking completion stats |
| PUT | /batches/:batchId/complete | Mark batch as complete |

#### 2.5 Dropdowns, notifications, referrals

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /dropdowns | Fetch dropdown options |
| GET | /dropdowns/batches | Fetch batch dropdown data |
| GET | /dropdowns/manage | Manage dropdown groups |
| POST | /dropdowns/groups | Create dropdown group |
| PUT | /dropdowns/groups/:id | Update dropdown group |
| DELETE | /dropdowns/groups/:id | Delete dropdown group |
| POST | /dropdowns/options | Create dropdown option |
| PUT | /dropdowns/options/:id | Update dropdown option |
| DELETE | /dropdowns/options/:id | Delete dropdown option |
| GET | /notifications | Fetch notifications |
| POST | /notifications/read-all | Mark all read |
| POST | /notifications/read | Mark one notification read |
| GET | /referrals/settings | Fetch referral settings |
| PUT | /referrals/settings | Update referral settings |

#### 2.6 Static pages and blog content

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /static-pages | List static pages |
| GET | /static-pages/:pageKey | Fetch static page |
| PUT | /static-pages/:pageKey | Update static page |
| GET | /postEditor | List blog posts |
| GET | /postEditor/:id | Fetch a post by id |
| POST | /postEditor | Create blog post |
| POST | /postEditor/:id | Update blog post |
| DELETE | /postEditor/:id | Delete blog post |

#### 2.7 Categories and reviews

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /categories | Fetch categories |
| GET | /categories/manage | Manage category list |
| POST | /categories | Create category |
| PUT | /categories/:id | Update category |
| DELETE | /categories/:id | Delete category |
| GET | /reviews | View reviews |

#### 2.8 Coupons

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /coupons | View coupons |
| POST | /coupons | Create coupon |
| PUT | /coupons/:id | Update coupon |
| DELETE | /coupons/:id | Delete coupon |

---

## 3. Admin UI Overview

### Project entry

- Angular app: `goWILDKarunadu-admin-ui/`
- App routing definition: `goWILDKarunadu-admin-ui/src/app/app.routes.ts`

### Admin UI main modules

| Route | Module | Purpose |
|---|---|---|
| / | login | Admin sign-in |
| /admin/dashboard | dashboard | Dashboard overview |
| /admin/treks/list | treks | Trek list |
| /admin/treks/add | treks | Add new trek |
| /admin/treks/edit | treks | Edit existing trek |
| /admin/bookings | bookings | Booking dashboard |
| /admin/users | users | User management |
| /admin/reviews | reviews | Review moderation |
| /admin/blog/posts | blog | Blog post list |
| /admin/blog/editor | blog | Blog editor |
| /admin/content-pages | static-pages | Static content pages |
| /admin/revenue | analytics | Revenue analytics |
| /admin/trek-details | tour-details | Trek details preview |
| /admin/batch-management | trek-batch-management | Batch scheduling and controls |
| /admin/operations | operations-center | Operations and audit views |
| /admin/notifications | notifications | notifications core |
| /admin/dropdowns | dropdown-manager | Dropdown and metadata management |
| /admin/categories | categories | Categories manager |
| /admin/referrals | referrals | Referral settings |
| /admin/coupons | coupon-manager | Coupon management |

### Admin UI feature areas

- Trek lifecycle management: add, edit, batch management, booking control
- Content management: blog posts, categories, static pages
- User and role controls: RBAC, admin creation, user listing
- Analytics: revenue, bookings, completion stats
- Operations: audit logs and system-level oversight
- Promotions: referral settings and coupon management

---

## 4. User API Overview

### Base setup

- App entry: `goWILDKarunadu-user-api/app.js`
- Auth and feature route entry: `goWILDKarunadu-user-api/src/routes/auth.routes.js`
- Main controller set: `goWILDKarunadu-user-api/src/controllers/`

### User API endpoint categories

#### 4.1 Authentication

| Method | Endpoint | Purpose |
|---|---|---|
| POST | /api/auth/login | User login |
| POST | /api/auth/register | User registration |
| POST | /api/auth/send-otp | Send OTP |
| POST | /api/auth/verify-otp | Verify OTP |
| POST | /api/auth/forgot-password | Forgot password |
| POST | /api/auth/reset-password | Reset password |
| POST | /api/auth/validate-reset-token | Validate reset token |

#### 4.2 Dashboard and metadata

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/auth/dashData | Public dashboard data |
| GET | /api/auth/meta/dropdowns/:type | Dropdown options by type |
| GET | /api/auth/meta/categories | Categories metadata |
| GET | /api/auth/meta/available-years | Available year list |

#### 4.3 Trek browsing

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/auth/getTrekByUuid/:id | Trek details by UUID |
| GET | /api/auth/getAllTreks | All treks |
| GET | /api/auth/by-month/:year/:month | Treks by month |
| GET | /api/auth/stats/monthly/:year | Monthly trek stats |
| GET | /api/auth/:id | Trek detail by id |
| GET | /api/auth/ | Get upcoming trips list |

#### 4.4 Booking flows

| Method | Endpoint | Purpose |
|---|---|---|
| POST | /api/auth/booking | Create booking |
| POST | /api/auth/coupon/validate | Validate coupon |
| GET | /api/auth/coupons/trek/:trekId | Get coupons for trek |
| GET | /api/auth/getMyBookingsById/:id | User booking history |
| GET | /api/auth/bookings/:userId/:bookingId/receipt | Booking receipt |
| POST | /api/auth/bookings/:userId/:bookingId/rating | Submit trek rating |
| POST | /api/auth/bookings/:bookingId/cancel | Cancel booking |

#### 4.5 Referral flow

| Method | Endpoint | Purpose |
|---|---|---|
| POST | /api/auth/referrals/validate | Validate referral code |
| GET | /api/auth/referrals/:userId/summary | Referral summary |
| GET | /api/auth/referrals/:userId/code | Get or create referral code |

#### 4.6 Blog and content

| Method | Endpoint | Purpose |
|---|---|---|
| GET | /api/auth/blog/posts | List blog posts |
| GET | /api/auth/blog/posts/:id | Get blog post |
| GET | /api/auth/blog/posts/related | Related blog posts |
| GET | /api/auth/blog/posts/:id/comments | Post comments |
| GET | /api/auth/blog/categories | Blog categories |
| GET | /api/auth/blog/tags | Blog tags |
| POST | /api/auth/blog/posts | Create blog post (auth required) |
| PUT | /api/auth/blog/posts/:id | Update blog post (auth required) |
| DELETE | /api/auth/blog/posts/:id | Delete blog post (auth required) |
| POST | /api/auth/blog/comments | Add comment (auth required) |
| PUT | /api/auth/blog/comments/:id | Update comment (auth required) |
| POST | /api/auth/blog/comments/:id | Delete comment (auth required) |
| POST | /api/auth/blog/posts/:id/like | Like post |
| POST | /api/auth/blog/comments/:id/like | Like comment |
| POST | /api/auth/blog/posts/:id/view | Increment view count |

---

## 5. User UI Overview

### Project entry

- Angular app: `goWILDKarunadu-user-ui/`
- Routing module: `goWILDKarunadu-user-ui/src/app/app-routing.module.ts`

### User UI main screens

| Route | Module | Purpose |
|---|---|---|
| / | dashboard | Home dashboard/search landing |
| /upcomingtours | upcomingtours | Upcomig tours list |
| /tour-details | tour-details | Trek detail page |
| /booking | booking | Booking form |
| /about | about | About us |
| /faqs | faqs | FAQ page |
| /blog | blog | Blog listings |
| /blog-details | blog-detail | Blog detail |
| /my-bookings | my-bookings | User bookings |
| /cancel-bookings | cancle-bookings | Canceled bookings |
| /terms-and-conditions | Quicklinks | Terms and conditions |
| /cancellation-policy | Quicklinks | Cancellation policy |
| /search | search | Search page |
| /blog-post | blog-post | User blog post creation/page |
| /reset-password | auth | Password reset |

### User UI feature areas

- Trek discovery and filters
- Tour detail pages with media, availability, booking flow
- User booking dashboard and receipts
- Referral-based engagement
- Blog browsing and user interactions
- Account and password management

---

## 6. Environment and configuration notes

### Admin API config

Key settings include:

- `PORT`
- `JWT_SECRET`
- `RESPONSE_ENCRYPTION_KEY`
- `ENCRYPTION_SALT`
- `CORS_ORIGINS`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `STORAGE_MODE`
- `AWS_REGION`
- `S3_BUCKET`
- `CLOUDFRONT_URL`

### User API config

Key settings include:

- `CORS_ORIGINS`
- `JWT_SECRET`
- `DB_*` values
- `STORAGE_MODE`
- `S3_BUCKET` / `AWS_S3_BUCKET`
- `CLOUDFRONT_URL`
- `SHARED_UPLOADS_DIR`

### UI config

The frontends use runtime environment variables such as:

- `API_BASE_URL`
- `CONTENT_API_URL`
- `MEDIA_BASE_URL`
- `REFERRAL_SHARE_URL`
- `ENCRYPTION_KEY`
- `ENCRYPTION_SALT`

The production environment files are here:

- `goWILDKarunadu-admin-ui/src/environments/environment.prod.ts`
- `goWILDKarunadu-user-ui/src/environments/environment.prod.ts`

---

## 7. Recommended launch checklist

1. Configure production environment variables for all four apps.
2. Set the correct API base URLs in both admin and user frontend apps.
3. Add production domains to CORS allowlists.
4. Configure AWS S3 / CloudFront for media uploads.
5. Ensure DB connectivity and JWT secrets are valid in production.
6. Test login, booking, trek management, blog management, and media upload flows.
7. Verify the admin and user UIs route correctly to their respective backend services.

---

## 8. Summary

This project is split into four main parts:

- Admin API for operations and management
- Admin UI for staff workflows
- User API for public and customer-focused actions
- User UI for end-user browsing and booking

Together they support:

- trek discovery and booking
- blog and content publishing
- referral programs
- analytics and revenue monitoring
- media and image storage
- RBAC-secured admin operations

---

## 9. Useful project files

- Admin API routes: `goWILDKarunadu-admin-api/src/routes/common.routes.js`
- Admin frontend routes: `goWILDKarunadu-admin-ui/src/app/app.routes.ts`
- User API routes: `goWILDKarunadu-user-api/src/routes/auth.routes.js`
- User frontend routes: `goWILDKarunadu-user-ui/src/app/app-routing.module.ts`
- Admin storage logic: `goWILDKarunadu-admin-api/src/utils/storageFactory.js`
- User storage logic: `goWILDKarunadu-user-api/src/utils/storageFactory.js`

This file can be used as the main technical reference while building, testing, or deploying the project.
