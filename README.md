# Rental Bridge — Backend API

A production-grade RESTful API for the **Rental Bridge** property rental platform. Built with **Express 5**, **TypeScript**, **Drizzle ORM**, and **PostgreSQL** (hosted on Supabase).

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Database Management](#database-management)
- [API Reference](#api-reference)
- [Authentication](#authentication)
- [Role System](#role-system)
- [Error Handling](#error-handling)
- [Scripts](#scripts)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ |
| Framework | Express 5 |
| Language | TypeScript 6 |
| ORM | Drizzle ORM |
| Database | PostgreSQL (Supabase) |
| Auth | JSON Web Tokens (JWT) |
| Password Hashing | bcrypt (12 salt rounds) |
| Dev Runner | tsx (watch mode) |

---

## Project Structure

```
rental-bridge-backend-final/
├── src/
│   ├── index.ts              # App entry point, middleware, and route registration
│   ├── db/
│   │   ├── index.ts          # Drizzle client singleton
│   │   └── schema/
│   │       └── app.ts        # All table definitions, enums, and relations
│   ├── middlewares/
│   │   ├── authenticate.ts   # JWT verification middleware
│   │   ├── authorizeRole.ts  # Role-based access control middleware
│   │   └── verifyOwnership.ts# Resource ownership enforcement middleware
│   ├── routes/
│   │   ├── auth_routes.ts          # /api/auth — Login & registration
│   │   ├── users_routes.ts         # /api/users — User management (admin)
│   │   ├── properties_routes.ts    # /api/properties — Property CRUD
│   │   ├── property-assets_routes.ts # /api/property-assets — Images & amenities
│   │   ├── applications_routes.ts  # /api/applications — Rental applications
│   │   ├── bookings_routes.ts      # /api/bookings — Booking management
│   │   ├── payments_routes.ts      # /api/payments — Payment records
│   │   ├── maintenance_routes.ts   # /api/maintenance — Maintenance requests
│   │   └── reviews_routes.ts       # /api/reviews — Property reviews
│   ├── types/                # Shared TypeScript types
│   └── utils/
│       ├── dbErrorHandler.ts # PostgreSQL error code classifier
│       ├── hash.ts           # bcrypt password utilities
│       └── parseId.ts        # URL param integer parser and validator
├── drizzle/                  # Auto-generated migration files
├── drizzle.config.ts         # Drizzle Kit configuration
├── package.json
└── tsconfig.json
```

---

## Prerequisites

- **Node.js** v20 or higher
- **npm** v9 or higher
- A running **PostgreSQL** instance (Supabase recommended)

---

## Environment Variables

Create a `.env` file in the project root. **Never commit this file to source control.**

```env
# PostgreSQL connection string (via connection pooler for Supabase)
DATABASE_URL="postgresql://user:password@host:port/db?pgbouncer=true"

# Allowed frontend origin for CORS
FRONTEND_URL="http://localhost:5173"

# Strong random secret for signing JWTs — generate with:
# node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET="your-256-bit-secret-here"

# Server port (optional, defaults to 3000)
PORT=3000
```

> ⚠️ **Security Note:** Rotate your `JWT_SECRET` and `DATABASE_URL` credentials regularly. If these values are ever exposed, rotate them immediately.

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

Copy the example above into a `.env` file and fill in your values.

### 3. Push the database schema

```bash
npm run db:push
```

### 4. Start the development server

```bash
npm run dev
```

The server will start on `http://localhost:3000` with hot reload via `tsx watch`.

### 5. Verify it's running

```bash
curl http://localhost:3000/
# Expected: {"message":"Rental Bridge API running (Proxy Active) ✅"}
```

---

## Database Management

All database operations use **Drizzle Kit**:

```bash
# Generate migration files from schema changes
npm run db:generate

# Apply pending migrations
npm run db:migrate

# Push schema directly (development only — no migration history)
npm run db:push

# Open the Drizzle Studio GUI
npm run db:studio
```

### Schema Overview

| Table | Description |
|---|---|
| `users` | Platform users with role-based access (`admin`, `landlord`, `tenant`) |
| `properties` | Property listings with location, pricing, and feature flags |
| `property_images` | Images linked to properties (one primary per property enforced) |
| `amenities` | Master list of amenities (WiFi, Parking, etc.) |
| `property_amenities` | Many-to-many join between properties and amenities |
| `applications` | Tenant rental applications for properties |
| `bookings` | Confirmed rental agreements with date overlap prevention |
| `payments` | Payment records linked to bookings |
| `maintenance_requests` | Tenant-submitted maintenance issues |
| `reviews` | Tenant reviews and ratings for properties |

---

## API Reference

All endpoints are prefixed with `/api`.

### Authentication

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | Public | Register a new user |
| `POST` | `/auth/login` | Public | Login and receive a JWT |

### Users

> Requires `admin` role

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/users` | List all users |
| `GET` | `/users/:id` | Get user by ID |
| `POST` | `/users` | Create a user |
| `PUT` | `/users/:id` | Update a user |
| `DELETE` | `/users/:id` | Delete a user |

### Properties

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/properties` | Public | List all properties |
| `GET` | `/properties/:id` | Public | Get property details |
| `GET` | `/properties/owner/:ownerId` | Owner / Admin | Get properties by owner |
| `POST` | `/properties` | Authenticated | Create a property |
| `PUT` | `/properties/:id` | Owner / Admin | Update a property |
| `DELETE` | `/properties/:id` | Owner / Admin | Delete a property |

### Property Assets

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/property-assets/images/:propertyId` | Public | Get images for a property |
| `POST` | `/property-assets/images` | Authenticated | Add an image |
| `DELETE` | `/property-assets/images/:id` | Authenticated | Remove an image |
| `GET` | `/property-assets/amenities` | Public | List all amenities |
| `POST` | `/property-assets/amenities` | Authenticated | Create an amenity |
| `DELETE` | `/property-assets/amenities/:id` | Authenticated | Delete an amenity |
| `GET` | `/property-assets/property-amenities/:propertyId` | Public | Amenities for a property |
| `POST` | `/property-assets/property-amenities` | Authenticated | Assign amenity to property |
| `DELETE` | `/property-assets/property-amenities/:id` | Authenticated | Remove amenity from property |

### Applications

> Requires `tenant`, `landlord`, or `admin` role

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/applications` | Admin | List all applications |
| `GET` | `/applications/:id` | Owner | Get single application |
| `GET` | `/applications/tenant/:tenantId` | Tenant (own only) | Tenant's applications |
| `GET` | `/applications/property/:propertyId` | Landlord (own property) | Applications for property |
| `POST` | `/applications` | Tenant | Submit an application |
| `PUT` | `/applications/:id` | Owner / Landlord / Admin | Update an application |
| `DELETE` | `/applications/:id` | Owner / Admin | Withdraw an application |

### Bookings

> Requires `tenant`, `landlord`, or `admin` role

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/bookings` | List all bookings (admin) |
| `GET` | `/bookings/:id` | Get single booking |
| `GET` | `/bookings/tenant/:tenantId` | Tenant's bookings |
| `GET` | `/bookings/property/:propertyId` | Bookings for a property |
| `POST` | `/bookings` | Create a booking (overlap check included) |
| `PUT` | `/bookings/:id` | Update a booking |
| `DELETE` | `/bookings/:id` | Delete a booking |

### Payments

> Requires `tenant`, `landlord`, or `admin` role

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/payments` | List all payments |
| `GET` | `/payments/:id` | Get single payment |
| `GET` | `/payments/booking/:bookingId` | Payments for a booking |
| `POST` | `/payments` | Record a payment |
| `PUT` | `/payments/:id` | Update a payment |

### Maintenance

> Requires `tenant`, `landlord`, or `admin` role

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/maintenance` | List all requests |
| `GET` | `/maintenance/:id` | Get single request |
| `GET` | `/maintenance/tenant/:tenantId` | Tenant's requests |
| `GET` | `/maintenance/property/:propertyId` | Requests for a property |
| `POST` | `/maintenance` | Submit a maintenance request |
| `PUT` | `/maintenance/:id` | Update a request |
| `DELETE` | `/maintenance/:id` | Delete a request |

### Reviews

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/reviews` | Public | List all reviews |
| `GET` | `/reviews/property/:propertyId` | Public | Reviews for a property |
| `GET` | `/reviews/reviewer/:reviewerId` | Owner | Reviews by a user |
| `POST` | `/reviews` | Public | Submit a review |
| `PUT` | `/reviews/:id` | Public | Update a review |
| `DELETE` | `/reviews/:id` | Public | Delete a review |

---

## Authentication

The API uses **stateless JWT Bearer authentication**.

### Flow

1. Register or login via `/api/auth/register` or `/api/auth/login`
2. Receive a `token` in the response (valid for **7 days**)
3. Include the token in the `Authorization` header on all protected requests:

```
Authorization: Bearer <your_token>
```

### Token Payload

```json
{
  "id": 42,
  "role": "landlord",
  "iat": 1715000000,
  "exp": 1715604800
}
```

---

## Role System

| Role | Access Level |
|---|---|
| `admin` | Full access to all resources, bypasses all ownership checks |
| `landlord` | Can create/manage their own properties, view applications for their properties |
| `tenant` | Can browse properties, submit applications, create bookings and maintenance requests |

---

## Error Handling

All errors follow a consistent JSON format:

```json
{ "error": "Human-readable error message" }
```

| HTTP Code | Meaning |
|---|---|
| `400` | Bad Request — missing or invalid input |
| `401` | Unauthorized — missing or invalid JWT |
| `403` | Forbidden — authenticated but insufficient permissions |
| `404` | Not Found — resource does not exist |
| `409` | Conflict — duplicate entry or FK constraint violation |
| `500` | Internal Server Error — unexpected failure |

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with hot reload (tsx watch) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Start compiled production server |
| `npm run db:generate` | Generate Drizzle migration files |
| `npm run db:migrate` | Apply migrations to the database |
| `npm run db:push` | Push schema directly (dev only) |
| `npm run db:studio` | Open Drizzle Studio in the browser |
