import { Router } from "express";
import AuthController from "../controller/AuthController";
import { checkJwt } from "../middlewares/checkJwt";

const router = Router();
//Login route
router.post("/login", AuthController.login);

//Change my password
router.post("/change-password", [checkJwt], AuthController.changePassword);

//refresh Access Token
router.post('/token', AuthController.token);

export default router;