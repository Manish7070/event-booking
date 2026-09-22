# Eventra — System Architecture & Monorepo Design

## 1. Overview
Eventra is built using a modern full-stack monorepo layout separating client-side Single Page Application (SPA) concerns from server-side REST API services:

```
                      INTERNET / USER
                            │
                            ▼
                    VERCEL / CLOUD
                ┌───────────┴───────────┐
                │                       │
             CLIENT                   SERVER
         (React 19 + Vite)       (Express REST API)
                │                       │
                └───────────┬───────────┘
                            │
                            ▼
                    MONGODB ATLAS
```

## 2. Key Technology Choices
- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS 4, React Router v6, TanStack Query v5, Zustand, Lucide React, Recharts, `qrcode.react`.
- **Backend**: Node.js, Express.js, TypeScript, MongoDB Atlas, Mongoose ORM, JWT, bcryptjs, Zod, Razorpay SDK.
- **Security**: Helmet security headers, CORS origin filtering, Express Rate Limiting, Zod input sanitization, HMAC SHA256 payment signature verification.
