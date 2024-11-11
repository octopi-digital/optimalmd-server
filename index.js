const express = require("express");
const cors = require("cors");
const app = express();
const mongoose = require('mongoose');

require("dotenv").config();
const port = process.env.PORT || 5000;

// middle ware:
app.use(cors());
app.use(express.json());

const dbUser = process.env.DB_USER;
const dbPass = process.env.DB_PASS;
const mongodbUri = `mongodb+srv://${dbUser}:${dbPass}@cluster0.hdebc.mongodb.net/coltonPropertyDB?retryWrites=true&w=majority&appName=Cluster0`;

mongoose
  .connect(mongodbUri)
  .then(() => console.log('MongoDB connected successfully'))
  .catch((error) => console.error('MongoDB connection error:', error));

const authRoutes = require('./router/authRoutes');

app.use('/api/auth', authRoutes);


app.get("/", (req, res) => {
  res.send("MVP network is running...");
});

app.listen(port, (req, res) => {
  console.log(`MVP network is running on port: ${port}`);
});