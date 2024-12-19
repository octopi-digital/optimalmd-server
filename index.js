const express = require("express");
const cors = require("cors");
const app = express();
const mongoose = require("mongoose");
const cron = require("node-cron");
const moment = require("moment");
const axios = require("axios");
const { customEncrypt } = require("./hash");

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

const User = require("./model/userSchema");
const Payment = require("./model/paymentSchema");

const authRoutes = require("./router/authRoutes");
const dependentRoutes = require("./router/dependentRoutes");
const rxvaletRoutes = require("./router/rxvaletRoutes");
const getLyricRoutes = require("./router/getLyricRoutes");
const paymentRoutes = require("./router/paymentRoutes");
const planRoutes = require("./router/planRoutes");
const adminStatisticsRoutes = require("./router/adminStatisticRoutes");
const orgRoutes = require("./router/orgRoutes");
const { lyricURL, authorizedDotNetURL } = require("./baseURL");

app.use("/api/auth", authRoutes);
app.use("/api/dependent", dependentRoutes);
app.use("/api/rxvalet", rxvaletRoutes);
app.use("/api/getLyric", getLyricRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/admin/stats", adminStatisticsRoutes);
app.use("/api/org", orgRoutes);

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
    const getLyricUrl = `${lyricURL}/census/updateEffectiveDate`;
    const amount = 97;

    for (const user of usersToUpdate) {
      console.log("email: ", user.email);
      const planEndDate = moment(user.planEndDate, "MM/DD/YYYY");
      const daysRemaining = planEndDate.diff(moment(currentDate, "MM/DD/YYYY"), "days");
    
      // Send follow-up emails based on days remaining
      if (daysRemaining === 5 || daysRemaining === 2 || daysRemaining === 1) {
        try {
          await axios.post(
            "https://services.leadconnectorhq.com/hooks/fXZotDuybTTvQxQ4Yxkp/webhook-trigger/7bf736c7-e9cc-499a-8156-5d4edf5b0136",
            {
              firstName: user.firstName,
              email: user.email,
              message: `Your plan will expire in ${daysRemaining} day${daysRemaining > 1 ? "s" : ""}. We will automatically update your plan. If you don't want to update your plan, you can simply deactivate your account.`,
            }
          );
          console.log(`Follow-up email sent to ${user.email} for ${daysRemaining} day(s) remaining.`);
        } catch (err) {
          console.error(`Error sending follow-up email to ${user.email}:`, err);
        }
      }
      const cenSusloginResponse = await axios.post(
        `${lyricURL}/login`,
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
          `${authorizedDotNetURL}/xml/v1/request.api`,
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
        console.log(result);

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

        const formattedDob = moment(user.dob).format("MM/DD/YYYY");

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
          console.log("lyric response: ", resp.data);
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
          console.log("rxvalet resp: ", resp.data);
        } catch (err) {
          console.error("RxValet API Error:", err);
        }

        // update getlyric to plus plan
        const updateMemberData = new FormData();
        updateMemberData.append("primaryExternalId", user?._id);
        updateMemberData.append("groupCode", "MTMSTGOPT01");
        updateMemberData.append("planId", "2322");
        updateMemberData.append("planDetailsId", "3");
        updateMemberData.append("effectiveDate", effectiveDate);
        updateMemberData.append("terminationDate", terminationDate);
        updateMemberData.append("firstName", user.firstName);
        updateMemberData.append("lastName", user.lastName);
        updateMemberData.append("dob", formattedDob);
        updateMemberData.append("email", user.email);
        updateMemberData.append("primaryPhone", user.phone);
        updateMemberData.append("gender", user.sex === "Male" ? "m" : "f");
        updateMemberData.append("heightFeet", "0");
        updateMemberData.append("heightInches", "0");
        updateMemberData.append("weight", "0");
        updateMemberData.append("address", user.shipingAddress1);
        updateMemberData.append("address2", user.shipingAddress2 || "");
        updateMemberData.append("city", user.shipingCity);
        updateMemberData.append("stateId", user.shipingStateId);
        updateMemberData.append("timezoneId", "");
        updateMemberData.append("zipCode", user.shipingZip);
        updateMemberData.append("sendRegistrationNotification", "0");

        // Update user in Lyric
        const response = await axios.post(
          `${lyricURL}/census/updateMember`,
          updateMemberData,
          { headers: { Authorization: cenSusauthToken } }
        );
        console.log("lyrics data-: ", response.data);
        if (!response.data.success) {
          return res.status(500).json({
            error: "Failed to update user in Lyric system",
            data: response.data,
          });
        }

        // update rxvalet to plus plan
        const rxvaletUserInfo = {
          GroupID: "OPT800",
          MemberGUID: user?.PrimaryMemberGUID,
        };

        const rxvaletFormData = new FormData();
        Object.entries(rxvaletUserInfo).forEach(([key, value]) => {
          rxvaletFormData.append(key, value);
        });

        const rxRespose = await axios.post(
          "https://rxvaletapi.com/api/omdrx/member_change_plan.php",
          rxvaletFormData,
          { headers: { api_key: "AIA9FaqcAP7Kl1QmALkaBKG3-pKM2I5tbP6nMz8" } }
        );
        console.log("rxvalet data update plan: ", rxRespose.data);
        if (rxRespose.data.StatusCode !== "1") {
          return res.status(500).json({
            error: "Failed to update user plan in RxValet system",
            data: rxRespose.data,
          });
        }

        user.status = "Active";
        user.planStartDate = effectiveDate;
        user.planEndDate = terminationDate;
        await user.save();

        await axios.post(
          "https://services.leadconnectorhq.com/hooks/fXZotDuybTTvQxQ4Yxkp/webhook-trigger/f5976b27-57b1-4d11-b024-8742f854e2e9",
          {
            firstName: user.firstName,
            email: user.email,
            transactionId: result.transactionResponse.transId,
          }
        );
      } catch (err) {

        console.error(`Error processing user ${user._id}:`, err);
        await axios.post(
          "https://services.leadconnectorhq.com/hooks/fXZotDuybTTvQxQ4Yxkp/webhook-trigger/dcd0045a-9de0-410a-b968-120b1169562f",
          {
            firstName: user.firstName,
            email: user.email,
            reason: err,
          }
        );
      }
    }
  } catch (error) {
    console.error("Error running cron job:", error);
  }
});

app.get("/", (req, res) => {
  res.send("Optimal MD network is running...");
});

// app.post('/encrypt-users', async (req, res) => {
//   try {
//       // Find all users that need encryption, excluding the specific user
//       const users = await User.find({ email: { $ne: 'lowok43672@lofiey.com' } });

//       // Loop through users and encrypt their card number and CVC
//       for (let user of users) {
//           const encryptedCardNumber = customEncrypt(user.cardNumber);
//           const encryptedCVC = customEncrypt(user.cvc);

//           // Update user with encrypted values
//           user.cardNumber = encryptedCardNumber;
//           user.cvc = encryptedCVC;
//           console.log(`for user: ${user.email}, card number and cvc encrypted `);

//           // Save the updated user
//           await user.save();
//       }

//       res.status(200).json({ message: 'All users encrypted successfully, except the excluded one!' });
//   } catch (err) {
//       console.error(err);
//       res.status(500).json({ message: 'Failed to encrypt users' });
//   }
// });

app.listen(port, (req, res) => {
  console.log(`Optimal MD network is running on port: ${port}`);
});
