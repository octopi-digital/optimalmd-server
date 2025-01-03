const express = require("express");
const cors = require("cors");
const app = express();
const mongoose = require("mongoose");
// const cron = require("node-cron");
// const moment = require("moment");
// const axios = require("axios");
// const { customEncrypt, customDecrypt } = require("./hash");
// const { lyricURL, authorizedDotNetURL, production } = require("./baseURL");
// const { addLog } = require("./controller/logController");

require("dotenv").config();
const port = process.env.PORT || 5000;

// middle ware:
app.use(cors());
app.use(express.json({ limit: "50mb" })); // Increase required size

const dbUser = process.env.DB_USER;
const dbPass = process.env.DB_PASS;
const dbName = process.env.DB_NAME;
const mongodbUri = `mongodb+srv://${dbUser}:${dbPass}@cluster0.wvgg4.mongodb.net/${dbName}?retryWrites=true&w=majority&appName=Cluster0`;

// const mongodbUri = `mongodb://127.0.0.1:27017/${dbName}?directConnection=true&serverSelectionTimeoutMS=2000&appName=mongosh+2.3.7`;

mongoose
  .connect(mongodbUri)
  .then(() => console.log("MongoDB connected successfully"))
  .catch((error) => console.error("MongoDB connection error:", error));

// const User = require("./model/userSchema");
// const Payment = require("./model/paymentSchema");
// const Coupon = require("./model/couponSchema");
// const Plan = require("./model/planSchema");

const authRoutes = require("./router/authRoutes");
const dependentRoutes = require("./router/dependentRoutes");
const rxvaletRoutes = require("./router/rxvaletRoutes");
const getLyricRoutes = require("./router/getLyricRoutes");
const paymentRoutes = require("./router/paymentRoutes");
const planRoutes = require("./router/planRoutes");
const adminStatisticsRoutes = require("./router/adminStatisticRoutes");
const orgRoutes = require("./router/orgRoutes");
const blogRoutes = require("./router/blogRoutes");
const couponRoutes = require("./router/couponRoutes");
const logRoutes = require("./router/logRoutes");
const salesPartnerRoutes = require("./router/salesPartnerRoutes");
const startCronJobs = require("./cronJobs");

app.use("/api/auth", authRoutes);
app.use("/api/dependent", dependentRoutes);
app.use("/api/rxvalet", rxvaletRoutes);
app.use("/api/getLyric", getLyricRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/admin/stats", adminStatisticsRoutes);
app.use("/api/org", orgRoutes);
app.use("/api/blogs", blogRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/logs", logRoutes);
app.use("/api/sales-partners", salesPartnerRoutes);

startCronJobs();

app.get("/", (req, res) => {
  res.send("Optimal MD network is running...");
});

app.listen(port, () => {
  console.log(`Optimal MD network is running on port: ${port}`);
});