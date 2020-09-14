import { Router } from "express";
import AuthController from "../controller/AuthController";
import ChatController from "../controller/ChatController";
import { checkJwt } from "../middlewares/checkJwt";

const router = Router();

router.get('/:id([0-9]+)/:page([0-9]+)?', [checkJwt], ChatController.getChatByUserId);

export default router;