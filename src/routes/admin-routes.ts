import { Router } from "express";
import {  createEmployee, createVenue, getAdminDetails, getEmployees, getEmployeesById, getVenue, getVenueById, logoutEmployee, updateEmployee, updateVenue} from "../controllers/admin/admin-controller";

const router = Router();
//Emmpoyee routes
router.post("/create-employee", createEmployee);
router.put("/update-employee", updateEmployee);
router.get("/get-employees", getEmployees);
router.get("/get-employees-by-id", getEmployeesById);
router.post("/logout-employee", logoutEmployee);
router.get("/get-admin-details", getAdminDetails);

//Venue routes
router.post("/create-venue", createVenue)
router.put("/update-venue", updateVenue)
router.get("/get-venues", getVenue)
router.get("/get-venue-by-id", getVenueById)

export { router };
