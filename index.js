const express = require("express");
const cors = require("cors");
const app = express();
const mongoose = require("mongoose");
const cron = require("node-cron");
const moment = require("moment");
const axios = require("axios");
const { customEncrypt, customDecrypt } = require("./hash");
const { lyricURL, authorizedDotNetURL, production } = require("./baseURL");
const { addLog } = require("./controller/logController");

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

const User = require("./model/userSchema");
const Payment = require("./model/paymentSchema");
const Coupon = require("./model/couponSchema");

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
const Plan = require("./model/planSchema");
const logRoutes = require("./router/logRoutes");
const salesPartnerRoutes = require("./router/salesPartnerRoutes");

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

cron.schedule("0 0 * * *", async () => {
  try {
    const allUsers = await User.find({ status: "Active" });
    const currentDate = moment().format("MM/DD/YYYY");
    const usersToUpdate = allUsers.filter((user) => {
      const formattedPlanEndDate = moment(user.planEndDate, "MM/DD/YYYY", true);
      if (!formattedPlanEndDate.isValid()) {
        addLog("Cron Error", user?._id, `Invalid planEndDate for user: ${user?.firstName} ${user?.lastName}`);
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
    cenSusloginData.append(
      "email",
      `${
        production
          ? "mtmoptim01@mytelemedicine.com"
          : "mtmstgopt01@mytelemedicine.com"
      }`
    );
    cenSusloginData.append(
      "password",
      `${production ? "KCV(-uq0hIvGr%RCPRv5" : "xQnIq|TH=*}To(JX&B1r"}`
    );

    const effectiveDate = moment().format("MM/DD/YYYY");
    // const terminationDate = moment().add(1, "months").format("MM/DD/YYYY");
    const memberActive = "1";
    const getLyricUrl = `${lyricURL}/census/updateEffectiveDate`;
    // const plan = userPlan.planKey === "TRIAL" ? plus.name : userPlan.name;
    // let amount = 97;

    for (const user of usersToUpdate) {
      console.log("email: ", user.email);
      const planEndDate = moment(user.planEndDate, "MM/DD/YYYY");
      const daysRemaining = planEndDate.diff(
        moment(currentDate, "MM/DD/YYYY"),
        "days"
      );
      const userPlan = await Plan.findOne({ planKey: user.planKey });
      const plus = await Plan.findOne({ planKey: "ACCESS PLUS" });
      const plan =
        userPlan.planKey === "TRIAL" || plus.planKey
          ? plus.name
          : userPlan.name;
      let amount =
        userPlan.planKey === "TRIAL" || plus.planKey
          ? plus.price
          : userPlan.price;
      const terminationDate = moment()
        .add(userPlan.duration.value, userPlan.duration.unit)
        .format("MM/DD/YYYY");
      // Send follow-up emails based on days remaining
      if (daysRemaining === 5 || daysRemaining === 2 || daysRemaining === 1) {
        try {
          await axios.post(
            "https://services.leadconnectorhq.com/hooks/fXZotDuybTTvQxQ4Yxkp/webhook-trigger/7bf736c7-e9cc-499a-8156-5d4edf5b0136",
            {
              firstName: user.firstName,
              email: user.email,
              message: `Your plan will expire in ${daysRemaining} day${
                daysRemaining > 1 ? "s" : ""
              }. We will automatically update your plan. If you don't want to update your plan, you can simply deactivate your account.`,
            }
          );
          console.log(`Follow-up email sent to ${user.email} for ${daysRemaining} day(s) remaining.`);
          addLog("Cron Info", user?._id, `Follow-up email sent to ${user?.email} for ${daysRemaining} day(s) remaining.`);
        } catch (err) {
          addLog("Cron Error", user?._id,`Error sending follow-up email to ${user?.email}`);
          console.error(`Error sending follow-up email to ${user.email}:`, err);
        }
      }
      const cenSusloginResponse = await axios.post(
        `${lyricURL}/login`,
        cenSusloginData
      );

      const cenSusauthToken = cenSusloginResponse.headers["authorization"];
      if (!cenSusauthToken) {
        addLog("Cron Error", user?._id, `Authorization token missing for GetLyric API for user: ${user?.firstName} ${user?.lastName}`);
        return res
          .status(401)
          .json({ error: "Authorization token missing for GetLyric." });
      }

      try {
        console.log("Before amount: ", amount);
        let couponCode = "";
        let discount = 0;

        if (
          Array.isArray(user.appliedCoupon) &&
          user.appliedCoupon.length > 0
        ) {
          const coupon = await Coupon.findOne({
            couponCode: user.appliedCoupon[0],
          });

          if (!coupon) {
            discount = 0;
          } else {
            console.log("coupon: ", coupon);
            if (
              coupon.status === "Active" &&
              (!coupon.selectedPlans.length ||
                coupon.selectedPlans.includes(
                  userPlan.planKey === "TRIAL" || plus.planKey
                    ? plus.planKey
                    : userPlan.planKey
                )) &&
              (coupon.numberOfRedeem === -1 ||
                coupon.redemptionCount < coupon.numberOfRedeem) &&
              coupon.recurringOrFuturePayments
            ) {
              // Calculate the discount based on coupon type
              if (coupon.couponType === "Percentage") {
                discount = (amount * coupon.discountOffered) / 100;
              } else if (coupon.couponType === "Fixed Amount") {
                discount = coupon.discountOffered;
              } else {
                discount = 0;
              }

              console.log("Discount: ", discount);

              // Apply the discount to the amount
              amount -= discount;

              if(amount < 0) {
                amount = 0;
              }
              couponCode = coupon.couponCode;
            } else {
              // Return an error if coupon is invalid or not applicable
              discount = 0;
              couponCode = "";
            }
          }
        }

        console.log("After amount: ", amount);
        // Payment processing logic
        let paymentMethod;

        if (user.paymentOption === "Card") {
          // Use credit card payment
          paymentMethod = {
            creditCard: {
              cardNumber: customDecrypt(user.cardNumber),
              expirationDate: user.expiration,
              cardCode: customDecrypt(user.cvc),
            },
          };
        } else if (user.paymentOption === "Bank") {
          // Use bank account payment
          paymentMethod = {
            bankAccount: {
              accountType: "checking",
              routingNumber: customDecrypt(user.routingNumber),
              accountNumber: customDecrypt(user.accountNumber),
              nameOnAccount: user.accountName,
            },
          };
        }
        else {
          addLog("Cron Error", user?._id, "Invalid payment details: Either card or bank account information must be provided.");
          return res.status(400).json({
            success: false,
            error:
              "Invalid payment details. Provide either card or bank account information.",
          });
        }
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
                payment: paymentMethod,
              },
            },
          },
          {
            headers: { "Content-Type": "application/json" },
          }
        );
        const result = paymentResponse.data;
        // console.log(result);

        if (paymentResponse?.data?.transactionResponse?.transId === "0") {
          // return res.status(500).json({ error: paymentResponse.data.transactionResponse.errors, message: paymentResponse.data.messages.message});

          user.status = "Canceled";
          await user.save();

          await axios.post(
            "https://services.leadconnectorhq.com/hooks/fXZotDuybTTvQxQ4Yxkp/webhook-trigger/dcd0045a-9de0-410a-b968-120b1169562f",
            {
              firstName: user.firstName,
              email: user.email,
              reason:
                paymentResponse.data?.transactionResponse?.errors ||
                "Payment Failed !",
            }
          );

          // for now we are not disableing the user from rx and lyric
          continue;
        }

        // Save Payment to the Payment Schema
        const payment = new Payment({
          userId: user._id,
          amount: amount,
          plan:
            userPlan.planKey === "TRIAL" || plus.planKey
              ? plus.name
              : userPlan.name,
          planKey:
            userPlan.planKey === "TRIAL" || plus.planKey
              ? plus.planKey
              : userPlan.planKey,
          transactionId: result.transactionResponse.transId,
          paymentReason: "User plan upgraded/Renew to Access Plus",
        });
        await payment.save();
        addLog("Cron Info", user?._id, `User's new payment history saved successfully: ${user?.firstName} ${user?.lastName}.`);

        // Save Coupon Redemption
        if (discount > 0 && couponCode) {
          await Coupon.updateOne(
            { couponCode },
            { $inc: { redemptionCount: 1 }, $addToSet: { appliedBy: user._id } }
          );
          addLog("Cron Info", user?._id, `Coupon redeemed successfully.`);

        }

        if (
          Array.isArray(user.appliedCoupon) &&
          couponCode &&
          !user.appliedCoupon.includes(couponCode)
        ) {
          user.appliedCoupon.push(couponCode);
        }

        // Add payment to user's payment history and update plan
        user.paymentHistory.push(payment._id);
        user.plan =
          userPlan.planKey === "TRIAL" || plus.planKey
            ? plus.name
            : userPlan.name;
        user.planKey =
          userPlan.planKey === "TRIAL" || plus.planKey
            ? plus.planKey
            : userPlan.planKey;
        await user.save();

        

        const formattedDob = moment(user.dob).format("MM/DD/YYYY");

        // Update GetLyric API
        try {
          const getLyricFormData = new FormData();
          getLyricFormData.append("primaryExternalId", user._id);
          getLyricFormData.append(
            "groupCode",
            `${production ? "MTMOPTIM01" : "MTMSTGOPT01"}`
          );
          getLyricFormData.append("terminationDate", terminationDate);
          getLyricFormData.append("effectiveDate", effectiveDate);
          const resp = await axios.post(getLyricUrl, getLyricFormData, {
            headers: { Authorization: cenSusauthToken },
          });

          addLog("Cron Info", user?._id, `User GetLyric Api updated successfully for user: ${user?.firstName} ${user?.lastName}.`);
          console.log("lyric response: ", resp.data);
        } catch (err) {
          addLog("Cron Error", user?._id, `GetLyric API Error for: ${user?.firstName} ${user?.lastName}.`);
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
          addLog("Cron Info", user?._id, `User RxValet Api updated successfully for: ${user?.firstName} ${user?.lastName}.`);
          console.log("rxvalet resp: ", resp.data);
        } catch (err) {
          addLog("Cron Error", user?._id, `RxValet API Error for: ${user?.firstName} ${user?.lastName}.`);
          console.error("RxValet API Error:", err);
        }

        const stagingPlanId = user.planKey === "ACCESS" ? "2322" : "2323";
        const prodPlanId = user.planKey === "ACCESS" ? "4690" : "4692";

        // update getlyric to plus plan
        const updateMemberData = new FormData();
        updateMemberData.append("primaryExternalId", user?._id);
        updateMemberData.append(
          "groupCode",
          `${production ? "MTMOPTIM01" : "MTMSTGOPT01"}`
        );
        updateMemberData.append(
          "planId",
          production ? prodPlanId : stagingPlanId
        );
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

        addLog("Cron Info", user?._id, `User updated in Lyric system successfully for: ${user?.firstName} ${user?.lastName}.`);
        // console.log("lyrics data-: ", response.data);
        if (!response.data.success) {
          addLog("Cron Error", user?._id, `Failed to update user in Lyric system for: ${user?.firstName} ${user?.lastName}.`);
          return res.status(500).json({
            error: "Failed to update user in Lyric system",
            data: response.data,
          });
        }

        // update rxvalet to plus plan
        const rxvaletUserInfo = {
          GroupID:
            userPlan.planKey === "TRIAL" || plus.planKey ? "OPT800" : "OPT125",
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
        addLog("Cron Info", user?._id, `User updated in RxValet system successfully for: ${user?.firstName} ${user?.lastName}.`);
        // console.log("rxvalet data update plan: ", rxRespose.data);
        if (rxRespose.data.StatusCode !== "1") {

          addLog("Cron Error", user?._id, `Failed to update user plan in RxValet system for: ${user?.firstName} ${user?.lastName}.`);
          return res.status(500).json({
            error: "Failed to update user plan in RxValet system",
            data: rxRespose.data,
          });
        }

        user.status = "Active";
        user.planStartDate = effectiveDate;
        user.planEndDate = terminationDate;
        await user.save();

        addLog("Cron Info", user?._id, `User plan updated to ${userPlan.planKey === "TRIAL" || plus.planKey ? plus.name : userPlan.name} successfully for: ${user?.firstName} ${user?.lastName}.`);

        await axios.post(
          "https://services.leadconnectorhq.com/hooks/fXZotDuybTTvQxQ4Yxkp/webhook-trigger/f5976b27-57b1-4d11-b024-8742f854e2e9",
          {
            firstName: user.firstName,
            email: user.email,
            transactionId: result.transactionResponse.transId,
          }
        );
      } catch (err) {
        console.error(`Error processing user`, err);
      }
    }
  } catch (error) {
    console.error("Error running cron job:", error);
  }
});

app.get("/", (req, res) => {
  res.send("Optimal MD network is running...");
});

app.listen(port, () => {
  console.log(`Optimal MD network is running on port: ${port}`);
});