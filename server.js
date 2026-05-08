import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

dotenv.config();

// Database connection
import "./config/db.js";

// Express app
const app = express();

// Core middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  }),
);

// Rate limiting for auth routes
// const authLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 5, // 5 requests per window
//   message: "Too many login attempts, please try again later",
//   standardHeaders: true,
//   legacyHeaders: false,
// });

// Health check
app.get("/", (req, res) => {
  res.json({ success: true, message: "HireIQ API is running" });
});

// Routes
import authRoutes from "./routes/auth.routes.js";
import jobRoutes from "./routes/jobs.routes.js";
import userRoutes from "./routes/users.routes.js";
import companyRoutes from "./routes/company.routes.js";
import aiRoutes from "./routes/ai.routes.js";

//app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/auth",  authRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/users", userRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/ai", aiRoutes);

// Error handling middleware (must be last)
import errorHandler from "./middleware/error.middleware.js";
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5001;
const server = app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  server.close(() => process.exit(1));
});

export default server;
