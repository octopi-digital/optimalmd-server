const express = require("express");
const cors = require("cors");
const app = express();
const mongoose = require("mongoose");
const cron = require("node-cron");
const moment = require('moment');

require("dotenv").config();
const port = process.env.PORT || 5000;

// middle ware:
app.use(cors());
app.use(express.json());

const dbUser = process.env.DB_USER;
const dbPass = process.env.DB_PASS;
const dbName = process.env.DB_NAME;
const mongodbUri = `mongodb+srv://${dbUser}:${dbPass}@cluster0.wvgg4.mongodb.net/${dbName}?retryWrites=true&w=majority&appName=Cluster0`;

mongoose
  .connect(mongodbUri)
  .then(() => console.log("MongoDB connected successfully"))
  .catch((error) => console.error("MongoDB connection error:", error));

const authRoutes = require("./router/authRoutes");
const dependentRoutes = require("./router/dependentRoutes");
const rxvaletRoutes = require("./router/rxvaletRoutes");
const getLyricRoutes = require("./router/getLyricRoutes");
const paymentRoutes = require("./router/paymentRoutes");
const planRoutes = require("./router/plan.routes");

app.use("/api/auth", authRoutes);
app.use("/api/dependent", dependentRoutes);
app.use("/api/rxvalet", rxvaletRoutes);
app.use("/api/getLyric", getLyricRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/plans", planRoutes);
const User = require("./model/userSchema");
const Payment = require("./model/paymentSchema");

// // Cron job to run every 2 minutes
// cron.schedule("*/1 * * * *", async () => {
//   try {

//     // Find users with active status, trial plan, and past planEndDate
//     const usersToUpdate = await User.find({
//       status: "Active", // Match exact case
//       plan: "Trial",
//       planEndDate: { $lte: moment().format("MM/DD/YYYY") }, // Compare formatted dates as strings
//     });

//     if (!usersToUpdate.length) {
//       console.log("No users found with trial plan that need updating.");
//       return;
//     }

//     // Log the users that meet the condition
//     console.log("Users whose trial plans need to be updated:");
//     usersToUpdate.forEach((user) => {
//       console.log(
//         `User ID: ${user._id}, Plan: ${user.plan}, Plan End Date: ${user.planEndDate}`
//       );
//     });
//   } catch (error) {
//     console.error("Error running cron job:", error);
//   }
// });

app.get("/", (req, res) => {
  res.send("Optimal MD network is running...");
});

app.listen(port, (req, res) => {
  console.log(`Optimal MD network is running on port: ${port}`);
});
