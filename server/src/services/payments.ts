import crypto from "crypto";
import Razorpay from "razorpay";
import { env } from "../config/env.js";
import { HttpError } from "../utils/http.js";
export function gateway() {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET)
    throw new HttpError(
      503,
      "Payments are not configured. Contact the platform operator.",
      "PAYMENTS_UNAVAILABLE",
    );
  return new Razorpay({
    key_id: env.RAZORPAY_KEY_ID,
    key_secret: env.RAZORPAY_KEY_SECRET,
  });
}
export function validSignature(
  payload: string | Buffer,
  signature: string,
  secret: string,
) {
  if (!secret || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  return crypto.timingSafeEqual(
    crypto.createHmac("sha256", secret).update(payload).digest(),
    Buffer.from(signature, "hex"),
  );
}
export async function verifiedPayment(
  orderId: string,
  paymentId: string,
  amount: number,
) {
  const payment = await gateway().payments.fetch(paymentId);
  if (
    payment.order_id !== orderId ||
    Number(payment.amount) !== amount ||
    payment.currency !== "INR" ||
    payment.status !== "captured"
  )
    throw new HttpError(
      409,
      "Payment has not been captured for this order and amount. Retry after capture.",
      "PAYMENT_NOT_CAPTURED",
    );
  return payment;
}
