import { Router } from "express";
import UserController from "../controller/UserController";
import { checkJwt } from "../middlewares/checkJwt";
import { checkRole } from "../middlewares/checkRole";

const router = Router();

//Get all users
router.get("/", [checkJwt, checkRole(["ADMIN"])], UserController.listAll);

// Get one user
router.get(
  "/:id([0-9]+)",
  [checkJwt, checkRole(["ADMIN"])],
  UserController.getOneById
);

//Create a new user
router.post("/register", UserController.register);

//Activate User account
router.post('/activate', UserController.activateAccount);

//Edit one user
router.patch(
  "/:id([0-9]+)",
  [checkJwt],
  UserController.editUser
);

//Delete one user
router.delete(
  "/:id([0-9]+)",
  [checkJwt, checkRole(["ADMIN"])],
  UserController.deleteUser
);

router.post('/test', [checkJwt], UserController.test);

export default router;