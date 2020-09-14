import { Request, Response } from "express";
import * as jwt from "jsonwebtoken";
import { getRepository } from "typeorm";
import { validate } from "class-validator";

import User from "../entity/User";
import config from "../config/config";
import ExpiredAccessToken from "../entity/ExpiredAccessToken";

class AuthController {
  static login = async (req: Request, res: Response) => {
    //Check if username and password are set
    let { email, password } = req.body;
    if (!(email && password)) {
      res.status(400).send();
    }

    //Get user from database
    const userRepository = getRepository(User);
    let user: User;
    try {
      user = await userRepository.findOneOrFail({ where: { email } });
    } catch (e) {
      const error = [{ 
        constraints: {
          isLoginCorrect: "Nie znaleziono użytkownika z podanym adresem E-mail"
        }
      }];
      res.status(404).send(error);
      return;
    }

    //Check if encrypted password match
    if (!user.checkIfUnencryptedPasswordIsValid(password)) {
      const error = [{
        constraints: {
          isLoginCorrect: "Błędne dane logowania. Spróbuj ponownie"
        }
      }];
      res.status(404).send(error);
      return;
    }


    const accessToken = jwt.sign(
      { id: user.id, username: user.username, surname: user.surname, email: user.email, role: user.role },
      config.jwtSecret,
      { expiresIn: "2m" }
    );

    const refreshToken = jwt.sign(
      { id: user.id },
      config.jwtSecret,
      { expiresIn: "30m" }
    );

    res.status(200).json({ accessToken: accessToken, refreshToken: refreshToken });
  };

  static token = async (req: Request, res: Response) => {

    const fullAccessToken = <string>req.get("Authorization");
    const accessToken = fullAccessToken ? fullAccessToken.split(' ')[1] : null;
    const refreshToken = <string>req.body.refreshToken;
    let jwtPayload;

    //Try to validate the token and get data
    try {
      jwtPayload = <any>jwt.verify(refreshToken, config.jwtSecret);
      res.locals.jwtPayload = jwtPayload;
    } catch (error) {
      //If token is not valid, respond with 403 (forbidden)
      res.status(403).send('Refresh token is Invalid');
      return;
    }

    //Check if there was any changes in user data at database level
    const { id } = jwtPayload;
    let user: User;
    const userRepository = getRepository(User);

    try {
      user = await userRepository.findOneOrFail(id);
    } catch (error) {
      res.status(403).send('No user found');
      return;
    }

    //Check if token is not expired
    let expiredTokens: ExpiredAccessToken[];
    const tokensRepository = getRepository(ExpiredAccessToken);

    try {
      expiredTokens = await tokensRepository.find({ relations: ['user'] });
    } catch (e) {
      const error = [{
        constraints: {
          expiredToken: "Coś poszło nie tak podczas sprawdzania, czy token wygasł " + e
        }
      }];
      res.status(403).send(error);
      return;
    }

    expiredTokens.forEach(element => {
      if (element.expiredToken == accessToken && element.user.id == user.id) {
        res.status(403).send('Token was marked as expired');
        return;
      }
    });

    let currentToken = new ExpiredAccessToken();
    currentToken.expiredToken = accessToken;
    currentToken.user = user;

    try {
      await tokensRepository.save(currentToken);
    } catch (e) {
      const error = [{
        constraints: {
          tokenSaveError: "Coś poszło nie tak podczas próby wygaszania tokenu " + e
        }
      }];
      res.status(403).send(error);
      return;
    } 

    const newToken = jwt.sign(
      { id: user.id, username: user.username, surname: user.surname, email: user.email, role: user.role },
      config.jwtSecret,
      { expiresIn: "2m" }
    );

    res.setHeader['Authorization'] = 'Bearer ' + newToken;
    res.json({ accessToken: newToken, refreshToken: refreshToken });
  };

  static changePassword = async (req: Request, res: Response) => {
    //Get ID from JWT
    const id = res.locals.jwtPayload.userId;

    //Get parameters from the body
    const { oldPassword, newPassword } = req.body;
    if (!(oldPassword && newPassword)) {
      res.status(400).send();
    }

    //Get user from the database
    const userRepository = getRepository(User);
    let user: User;
    try {
      user = await userRepository.findOneOrFail(id);
    } catch (id) {
      res.status(401).send();
    }

    //Check if old password matchs
    if (!user.checkIfUnencryptedPasswordIsValid(oldPassword)) {
      res.status(401).send();
      return;
    }

    //Validate de model (password lenght)
    user.password = newPassword;
    const errors = await validate(user);
    if (errors.length > 0) {
      res.status(400).send(errors);
      return;
    }
    //Hash the new password and save
    user.hashPassword();
    userRepository.save(user);

    res.status(204).send();
  };

}
export default AuthController;