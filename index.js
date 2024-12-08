const express = require("express");
const cors = require("cors");
const app = express();
const mongoose = require("mongoose");
const cron = require("node-cron");
const moment = require("moment");
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

cron.schedule("0 0 * * *", async () => {
  try {
    const allUsers = await User.find({ status: "Active" });
    const currentDate = moment().format("MM/DD/YYYY");
    const usersToUpdate = allUsers.filter((user) => {
      const formattedPlanEndDate = moment(user.planEndDate, "MM/DD/YYYY", true);
      if (!formattedPlanEndDate.isValid()) {
        console.error(`Invalid planEndDate for user: ${user._id}`);
        return false;
      }
      return formattedPlanEndDate.isBefore(
        moment(currentDate, "MM/DD/YYYY"),
        "day"
      );
    });

    if (!usersToUpdate.length) {
      console.log("No users found with trial plan that need updating.");
      return;
    }

    // Login to GetLyric API
    const cenSusloginData = new FormData();
    cenSusloginData.append("email", "mtmstgopt01@mytelemedicine.com");
    cenSusloginData.append("password", "xQnIq|TH=*}To(JX&B1r");

    const effectiveDate = moment().format("MM/DD/YYYY");
    const terminationDate = moment().add(1, "months").format("MM/DD/YYYY");
    const memberActive = "1";
    const getLyricUrl =
      "https://staging.getlyric.com/go/api/census/updateEffectiveDate";
    const amount = 97;

    for (const user of usersToUpdate) {
      console.log("email: ", user.email);

      const cenSusloginResponse = await axios.post(
        "https://staging.getlyric.com/go/api/login",
        cenSusloginData
      );
      const cenSusauthToken = cenSusloginResponse.headers["authorization"];
      if (!cenSusauthToken) {
        return res
          .status(401)
          .json({ error: "Authorization token missing for GetLyric." });
      }

      try {
        // Payment processing logic
        const paymentResponse = await axios.post(
          "https://apitest.authorize.net/xml/v1/request.api",
          {
            createTransactionRequest: {
              merchantAuthentication: {
                name: process.env.AUTHORIZE_NET_API_LOGIN_ID,
                transactionKey: process.env.AUTHORIZE_NET_TRANSACTION_KEY,
              },
              transactionRequest: {
                transactionType: "authCaptureTransaction",
                amount: amount,
                payment: {
                  creditCard: {
                    cardNumber: user.cardNumber,
                    expirationDate: user.expiration,
                    cardCode: user.cvc,
                  },
                },
              },
            },
          },
          {
            headers: { "Content-Type": "application/json" },
          }
        );
        const result = paymentResponse.data;

        if (paymentResponse.data?.transactionResponse?.errors) {
          // return res.status(500).json({ error: paymentResponse.data.transactionResponse.errors, message: paymentResponse.data.messages.message});
          continue;
        }

        // Save Payment to the Payment Schema
        const payment = new Payment({
          userId: user._id,
          amount: amount,
          plan: "Plus",
          transactionId: result.transactionResponse.transId,
        });
        await payment.save();

        // Add payment to user's payment history and update plan
        user.paymentHistory.push(payment._id);
        user.plan = "Plus";
        await user.save();

        // Update GetLyric API
        try {
          const getLyricFormData = new FormData();
          getLyricFormData.append("primaryExternalId", user._id);
          getLyricFormData.append("groupCode", "MTMSTGOPT01");
          getLyricFormData.append("terminationDate", terminationDate);
          getLyricFormData.append("effectiveDate", effectiveDate);
          const resp = await axios.post(getLyricUrl, getLyricFormData, {
            headers: { Authorization: cenSusauthToken },
          });
          console.log("lyric response: ", resp);
        } catch (err) {
          console.error("GetLyric API Error:", err);
        }

        // Update RxValet API
        try {
          const rxValetHeaders = {
            api_key: "AIA9FaqcAP7Kl1QmALkaBKG3-pKM2I5tbP6nMz8",
          };
          const rxValetFormData = new FormData();
          rxValetFormData.append("MemberGUID", user.PrimaryMemberGUID);
          rxValetFormData.append("MemberActive", memberActive);

          const resp = await axios.post(
            "https://rxvaletapi.com/api/omdrx/member_deactivate_or_reactivate.php",
            rxValetFormData,
            { headers: rxValetHeaders }
          );
          console.log("rxvalet resp: ", resp);
        } catch (err) {
          console.error("RxValet API Error:", err.message);
        }

        user.status = "Active";
        user.planStartDate = effectiveDate;
        user.planEndDate = terminationDate;
        await user.save();

        await axios.post(
          "https://services.leadconnectorhq.com/hooks/c4HwDVSDzA4oeLOnUvdK/webhook-trigger/80cb87cf-f703-4942-8269-5abc2fcfea95",
          {
            firstName: user.firstName,
            email: user.email,
            transactionId: result.transactionResponse.transId,
          }
        );

      } catch (err) {
        console.error(`Error processing user ${user._id}:`, err);
      }
    }
  } catch (error) {
    console.error("Error running cron job:", error);
  }
});

app.get("/", (req, res) => {
  res.send("Optimal MD network is running...");
});

app.listen(port, (req, res) => {
  console.log(`Optimal MD network is running on port: ${port}`);
});
