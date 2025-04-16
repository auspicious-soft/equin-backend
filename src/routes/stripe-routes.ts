import { Router } from "express";
import { checkoutSession, getStripeProducts, updateProductPrice } from "src/controllers/stripe/stripe-controller";

const router = Router();

router.post("/create-checkout-session", checkoutSession)

//*********************Future Admin Routes ********************/
router.put("/update-plan-price", updateProductPrice)

export { router };