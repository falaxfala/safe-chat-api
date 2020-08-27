import { Request, Response, NextFunction } from "express";
import * as jwt from "jsonwebtoken";
import config from "../config/config";

import { User } from '../entity/User';
import { getRepository } from "typeorm";
import { ExpiredAccessToken } from "../entity/ExpiredAccessToken";

export const checkJwt = async (req: Request, res: Response, next: NextFunction) => {
  //Get the jwt token from the head
  const fullToken = <string>req.get("Authorization");
  const token = fullToken ? fullToken.split(' ')[1] : null;
  let jwtPayload;

  //Try to validate the token and get data
  try {
    jwtPayload = <any>jwt.verify(token, config.jwtSecret);
    res.locals.jwtPayload = jwtPayload;
  } catch (error) {
    //If token is not valid, respond with 401 (unauthorized)
    res.status(401).send();
    return;
  }

  next();
};