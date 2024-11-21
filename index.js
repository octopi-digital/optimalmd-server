const express = require("express");
const cors = require("cors");
const app = express();
const mongoose = require("mongoose");
const axios = require("axios");

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

app.use("/api/auth", authRoutes);
app.use("/api/dependent", dependentRoutes);

// Route to handle the external API request
app.post("/api/rxvalet-login", async (req, res) => {
  try {
    const { MemberGUID, MemberID, MemberCode } = req.body;
    
    const formData = new FormData();
    formData.append("MemberGUID", MemberGUID);
    formData.append("MemberID", MemberID);
    formData.append("MemberCode", MemberCode);

    const response = await axios.post(
      "https://rxvaletapi.com/api/omdrx/member_login.php",
      formData,
      {
        headers: {
          api_key: "AIA9FaqcAP7Kl1QmALkaBKG3-pKM2I5tbP6nMz8",
        },
      }
    );

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error("Error calling the external API:", error.message);
    res.status(error.response?.status || 500).json({
      message: "Error calling the external API",
      error: error.message,
    });
  }
});

app.get("/", (req, res) => {
  res.send("Optimal MD network is running...");
});

app.listen(port, (req, res) => {
  console.log(`Optimal MD network is running on port: ${port}`);
});
