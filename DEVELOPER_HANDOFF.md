# Developer Handoff

## Project overview

This repository contains four apps:

- Admin API: `goWILDKarunadu-admin-api`
- Admin UI: `goWILDKarunadu-admin-ui`
- User API: `goWILDKarunadu-user-api`
- User UI: `goWILDKarunadu-user-ui`

## Stack

- Node.js + Express APIs
- Angular + Ionic frontends
- MySQL database
- AWS S3/CloudFront for uploads
- JWT-based auth

## Run locally

### 1) Admin API

```bash
cd goWILDKarunadu-admin-api
npm install
node server.js
```

Default port: `4001`

### 2) User API

```bash
cd goWILDKarunadu-user-api
npm install
node server.js
```

Default port: `4002`

### 3) Admin UI

```bash
cd goWILDKarunadu-admin-ui
npm install
npm start
```

Default port: `4700`

### 4) User UI

```bash
cd goWILDKarunadu-user-ui
npm install
npm start
```

Default port: `4600`

## Key route groups

### Admin API

- `/login`, `/me`, `/dashData`
- `/getUsers`, `/user/:userid/getUserById`
- `/createTrek`, `/getAllTreks`, `/getTrekById/:id`
- `/revenue`, `/bookingData`
- `/dropdowns`, `/notifications`, `/referrals/settings`
- `/postEditor`, `/categories`, `/reviews`

### User API

- `/api/auth/login`, `/register`, `/send-otp`, `/verify-otp`
- `/api/auth/getAllTreks`, `/api/auth/getTrekByUuid/:id`
- `/api/auth/booking`, `/api/auth/getMyBookingsById/:id`
- `/api/auth/blog/posts`, `/api/auth/blog/posts/:id`
- `/api/auth/referrals/:userId/summary`

## Important config points

- Frontend production URLs still default to localhost unless overridden.
- CORS must include live domains before production deployment.
- `STORAGE_MODE` should be set explicitly for the environment.
- Secrets must not remain in source-controlled `.env` files in production.

## High-priority follow-up items

1. Replace localhost URLs with production API domains.
2. Update CORS origins with live frontend domains.
3. Verify S3/CloudFront and storage config.
4. Move secrets to env or secure secret manager.
5. Run build/test smoke check for all four apps.

## Main file references

- Admin API routes: `goWILDKarunadu-admin-api/src/routes/common.routes.js`
- Admin UI routes: `goWILDKarunadu-admin-ui/src/app/app.routes.ts`
- User API routes: `goWILDKarunadu-user-api/src/routes/auth.routes.js`
- User UI routes: `goWILDKarunadu-user-ui/src/app/app-routing.module.ts`
- Project doc: `PROJECT_DOCUMENTATION.md`
