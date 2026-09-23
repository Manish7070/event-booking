import mongoose from "mongoose";
import { connectDB } from "./config/database.js";
import { User } from "./models/User.js";
import { email } from "./utils/http.js";

// An explicit operator command, never a public endpoint or automatic promotion.
async function main() {
  try {
    const target = email.parse(process.argv[2]);
    await connectDB();
    const user = await User.findOne({ email: target, isActive: true });
    if (!user)
      throw new Error("Register the intended administrator account first.");
    if (!user.isVerified)
      throw new Error(
        "Verify this account's email before granting administrator access.",
      );
    user.role = "ADMIN";
    user.tokenVersion += 1;
    await user.save();
    console.log(
      "Administrator access granted. Sign in again to use the admin workspace.",
    );
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "Administrator setup failed",
    );
    console.error(
      "Usage: npm run db:admin --workspace server -- admin@example.com",
    );
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
void main();
