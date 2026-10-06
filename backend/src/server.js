import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config();
import app from "./app.js";
import connectDB from "./config/db.js";
import { validateEnv } from "./config/env.js";
import { initSocket } from "./services/socket.service.js";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    validateEnv();
    await connectDB();

    const server = http.createServer(app);
    initSocket(server);

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
      console.log(`🚀 Environment: ${process.env.NODE_ENV || "development"}`);
    });
  } catch (error) {
    console.error("📦 Server startup failed:", error.message);
    process.exit(1);
  }
};

startServer();

