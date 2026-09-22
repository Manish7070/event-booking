# Eventra — Production Deployment Guide

## Vercel Deployment Instructions

1. Push repository to GitHub.
2. Connect repository to Vercel.
3. Configure environment variables in Vercel settings:
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET`
   - `CLIENT_URL`
4. Deploy using `vercel.json` monorepo configuration.
