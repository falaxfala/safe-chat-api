import { Router } from "express";
import auth from "./auth";
import user from "./user";
import chat from './chat';

const routes = Router();

routes.use("/auth", auth);
routes.use("/user", user);
routes.use('/chat', chat);
export default routes;