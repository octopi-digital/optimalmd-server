const express = require("express");
const cors = require("cors");
const app = express();
const mongoose = require("mongoose");

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

app.use("/api/auth", authRoutes);
app.use("/api/dependent", dependentRoutes);
app.use("/api/rxvalet", rxvaletRoutes);
app.use("/api/getLyric", getLyricRoutes);
app.use("/api/payment", paymentRoutes);

app.get("/", (req, res) => {
  res.send("Optimal MD network is running...");
});

app.listen(port, (req, res) => {
  console.log(`Optimal MD network is running on port: ${port}`);
});
