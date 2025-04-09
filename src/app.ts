import express from "express";
import cors from "cors";
// import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./config/db";
import { admin, auth, user } from "./routes";
// import admin from "firebase-admin"
import { checkValidAdminRole, checkValidPublisherRole } from "./utils";
import bodyParser from "body-parser";
import {
  login,
  newPassswordAfterOTPVerified,
} from "./controllers/admin/admin-controller";
import { forgotPassword } from "./controllers/admin/admin-controller";
import { checkAuth, checkPublisherAuth } from "./middleware/check-auth";
import { createPricePlan, createQuestions, getPricePlan, getQuestions, saveAnswers, savePricePlan, userSignUp } from "./controllers/auth/auth-controller";

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url); // <-- Define __filename
const __dirname = path.dirname(__filename); // <-- Define __dirname
// const serviceAccount = require(path.join(__dirname, 'config/firebase-adminsdk.json'));

const PORT = process.env.PORT || 8001;
const app = express();

app.use(express.json());
app.set("trust proxy", true);
app.use(
  bodyParser.json({
    verify: (req: any, res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);
// app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
// });

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PATCH", "DELETE", "PUT"],
    credentials: true,
  })
);

var dir = path.join(__dirname, "static");
app.use(express.static(dir));

var uploadsDir = path.join(__dirname, "uploads");
app.use("/uploads", express.static(uploadsDir));

connectDB();

app.get("/", (_, res: any) => {
  res.send("Hello world entry point 🚀✅");
});

// app.use("/api/admin",checkValidAdminRole,checkAuth, admin);
// app.use("/api/user",checkAuth, user);

//adminAuth routes 
// app.post("/api/login", login);
// app.post("/api/verify-otp", verifyOtpPasswordReset);
// app.post("/api/forgot-password", forgotPassword);
// app.patch("/api/new-password-otp-verified", newPassswordAfterOTPVerified);

//*****************User Auth Routes**************/
app.use("/api", auth)


app.listen(PORT, () => console.log(`Server is listening on port ${PORT}`));
