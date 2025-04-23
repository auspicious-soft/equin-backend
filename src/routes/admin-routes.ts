import { Router } from "express";
import {getAdminDetails,logoutEmployee} from "../controllers/admin/admin-controller";

const router = Router();
router.post("/logout-employee", logoutEmployee);
router.get("/get-admin-details", getAdminDetails);
export { router };
