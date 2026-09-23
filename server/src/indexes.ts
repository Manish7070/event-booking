import mongoose from "mongoose";
import "./app.js";
import { connectDB } from "./config/database.js";

// Create declared indexes without dropping existing indexes or records.
async function createIndexes() {
  try {
    await connectDB();
    for (const model of Object.values(mongoose.models)) {
      await model.createIndexes();
      console.log(`Indexes ready: ${model.modelName}`);
    }
  } catch (error) {
    console.error(
      "Index creation failed. Inspect conflicts before deployment.",
      error,
    );
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
void createIndexes();
