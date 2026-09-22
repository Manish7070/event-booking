# EVENTRA — Complete Production Full-Stack Event Booking Platform

**EVENTRA** is a production-grade full-stack event discovery, ticket booking, and management platform built with **React 19 + Vite**, **Express.js**, and **MongoDB Atlas**.

---

## 🌟 Highlights & Features
- **Monorepo Architecture**: Clean separation between `client/` (React + Vite + TS) and `server/` (Node + Express + TS).
- **100% Data-Driven**: Zero mock data fallbacks, zero `alert()` alerts, zero broken links.
- **MongoDB Atlas & Mongoose**: 20 normalized schemas with compound indexes, transactions, and serverless pooling.
- **Razorpay Payment Gateway**: 2-step order creation, HMAC-SHA256 signature verification, and atomic inventory deduction.
- **QR Ticket & Check-in System**: Dynamic QR pass generation on customer tickets and live QR check-in scanner for organizers.
- **Three Distinct Role Dashboards**: Customer, Organizer (including 8-step event creation wizard), and Admin control panel.

---

## 🛠️ Tech Stack
- **Frontend**: React 19, Vite, TypeScript, Tailwind CSS 4, React Router v6, TanStack Query v5, Zustand, Lucide React, Recharts, `qrcode.react`.
- **Backend**: Node.js, Express.js, TypeScript, MongoDB Atlas, Mongoose ORM, JWT, bcryptjs, Zod, Helmet, CORS, Razorpay.

---

## 🔑 Quick Start & Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` in both `client/` and `server/`:
```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

### 3. Seed Database
```bash
npm run db:seed
```

### 4. Start Development Servers
```bash
npm run dev
```
Client running at `http://localhost:5173`
Server API running at `http://localhost:5000/api/v1`

---

## 👥 Demo Credentials
- **ADMIN**: `admin@eventra.com` / `Password@123`
- **ORGANIZER**: `organizer@eventra.com` / `Password@123`
- **CUSTOMER**: `user@eventra.com` / `Password@123`
