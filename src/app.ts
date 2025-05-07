import express from "express";
import cors from "cors";
// import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./config/db";
import { admin, auth, stripe, user } from "./routes";
// import admin from "firebase-admin"
import bodyParser from "body-parser";
import { checkAuth } from "./middleware/check-auth";
import { handleStripeWebhook, stripeCancel, stripeSuccess } from "./controllers/stripe/stripe-controller";
import { initializeReminderCrons } from './services/admin/reminder-scheduler';
import { initializeFirebase } from "./utils/FCM/FCM";

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url); // <-- Define __filename
const __dirname = path.dirname(__filename); // <-- Define __dirname
// const serviceAccount = require(path.join(__dirname, 'config/firebase-adminsdk.json'));

const PORT = process.env.PORT || 8001;
const app = express();

// Initialize reminder cron jobs
initializeReminderCrons();

// Initialize firebase
initializeFirebase()

//*****************Stripe Routes*****************/
//Need Raw Body
app.post(`/webhook`, express.raw({ type: "application/json" }), handleStripeWebhook);
//*****************Stripe Routes*****************/


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


//*****************User Auth Routes**************/
app.use("/api", auth)

//*****************User Routes******************/
app.use("/api",checkAuth, user)


//*****************Stripe Test Routes*****************/
app.get('/success-test', stripeSuccess);
app.get('/cancel-test', stripeCancel);


app.use('/api', checkAuth, stripe);

app.listen(PORT, () => console.log(`Server is listening on port ${PORT}`));
