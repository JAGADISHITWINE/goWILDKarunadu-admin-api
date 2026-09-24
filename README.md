# GoWILD Karunadu Admin API

## Overview

This is the admin backend for the GoWILD Karunadu platform. It handles authentication, user management, trek management, bookings, analytics, referrals, blog content, and admin RBAC.

## Tech stack

- Node.js
- Express
- MySQL
- Sequelize
- JWT
- AWS S3 integration
- Multer + Sharp for image upload processing

## Project structure

```text
goWILDKarunadu-admin-api/
├── app.js
├── server.js
├── src/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── service/
│   ├── utils/
│   └── config/
├── uploads/
├── .env
└── package.json
```

## Local setup

```bash
cd goWILDKarunadu-admin-api
npm install
node server.js
```

Default port:

- `4001`

## Main routes

- `/login`, `/logout`, `/me`
- `/getUsers`, `/user/:userid/getUserById`
- `/createTrek`, `/getAllTreks`, `/getTrekById/:id`
- `/revenue`, `/bookingData`
- `/dropdowns`, `/notifications`, `/referrals/settings`
- `/postEditor`, `/categories`, `/reviews`
- `/static-pages`
- `/coupons`

## Important config

Edit the `.env` file before running in production:

- `PORT`
- `JWT_SECRET`
- `RESPONSE_ENCRYPTION_KEY`
- `DB_*`
- `CORS_ORIGINS`
- `STORAGE_MODE`
- `AWS_REGION`
- `S3_BUCKET`
- `CLOUDFRONT_URL`

## Production notes

- Do not commit real secrets in source control.
- Set `CORS_ORIGINS` to actual deployed frontend domains.
- Use `STORAGE_MODE=s3` in production if using AWS.
- Ensure `ADMIN_AWS_ACCESS_KEY` and `ADMIN_AWS_SECRET_KEY` are valid.

## Main file references

- Routes: `src/routes/common.routes.js`
- Storage: `src/utils/storageFactory.js`
- App entry: `app.js`

---

See also: `PROJECT_DOCUMENTATION.md` and `DEVELOPER_HANDOFF.md`.
