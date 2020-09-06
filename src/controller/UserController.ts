import { Request, Response, request } from "express";
import { getRepository } from "typeorm";
import { validate } from "class-validator";

import { User } from "../entity/User";
import config from '../config/config';
import * as jwt from 'jsonwebtoken';
import FriendsRequest from "../entity/FriendRequest";

const nodemailer = require('nodemailer');


class UserController {

    static listAll = async (req: Request, res: Response) => {
        //Get users from database
        const userRepository = getRepository(User);
        const users = await userRepository.find({
            select: ["id", "username", "role"] //We dont want to send the passwords on response
        });

        //Send the users object
        res.send(users);
    };

    static getOneById = async (req: Request, res: Response) => {
        //Get the ID from the url
        const id: any = req.params.id;

        //Get the user from database
        const userRepository = getRepository(User);
        let user;
        try {
            user = await userRepository.findOneOrFail(id, {
                select: ["id", "username", "surname", "email", "role", "createdAt"] //We dont want to send the password on response
            });
        } catch (e) {
            const error = [{
                constraints: {
                    isUserFound: "Wystąpił błąd. Nie znaleziono użytkownika."
                }
            }];
            res.status(404).send(error);
            return;
        }
        res.json(user);
    };

    static register = async (req: Request, res: Response) => {
        //Get parameters from the body
        let { username, password, surname, email, rPassword } = req.body;
        let user = new User();
        if (password == rPassword) {

            user.username = username;
            user.password = password;
            user.surname = surname;
            user.email = email;
            user.role = 'USER';
            user.publicProfile = true;
        } else {
            const error = [{
                constraints: {
                    isPasswordsMatch: "Hasła nie są takie same."
                }
            }];
            res.status(400).send(error);
            return;
        }

        //Validade if the parameters are ok
        const errors = await validate(user, { validationError: { target: false, value: false } });
        if (errors.length > 0) {
            res.status(400).send(errors);
            return;
        }

        //Hash the password, to securely store on DB
        user.hashPassword();
        user.makeActivationCode(30);

        //Try to save. If fails, the username is already in use
        const userRepository = getRepository(User);
        try {
            await userRepository.save(user);
        } catch (e) {
            const error = [{
                constraints: {
                    isEmailUnique: "Istnieje już użytkownik z podanym adresem E-mail"
                }
            }];
            res.status(409).send(error);
            return;
        }

        //Send veryfication email
        await UserController.sendVeryficationEmail(user);

        //If all ok, send 201 response
        res.status(201).send("Pomyślnie utworzono użytkownika.");
    };

    static sendVeryficationEmail = async (user: User) => {
        let transporter = nodemailer.createTransport(config.mailerSettings);


        const htmlMessage = '<strong><a target="_blank" href="http://localhost:3000/aktywacja/' + user.activationCode + '">Aktywuj konto</a></strong>';

        let info = await transporter.sendMail({
            from: 'naruto10000@o2.pl',
            to: user.email,
            subject: 'Aktywacja konta w serwisie Elektroteka',
            html: htmlMessage
        });
    }

    static activateAccount = async (req: Request, res: Response) => {
        const { code } = req.body;

        const userRepository = getRepository(User);
        let user = new User();
        try {
            user = await userRepository.findOneOrFail({ activationCode: code });
        } catch (error) {
            res.status(404).send("Nie znaleziono użytkownika, bądź konto zostało już aktywowane.");
            return;
        };

        user.activationCode = null;
        const email = user.email;
        try {
            await userRepository.save(user);
        } catch (error) {
            res.send(409).send("Przepraszamy, coś poszło nie tak. Proszę spróbować ponownie za jakiś czas, bądź skontaktować się z administracją serwisu.");
            return;
        }
        res.status(201).send({ email: email });
    };

    static editUser = async (req: Request, res: Response) => {
        //Get the ID from the url
        const id = req.params.id;
        let wasEmailChanged: boolean = false;

        //Get values from the body
        const { username, surname, email } = req.body;

        //Try to find user on database
        const userRepository = getRepository(User);
        let user = new User();
        try {
            user = await userRepository.findOneOrFail(id);
        } catch (error) {
            //If not found, send a 404 response
            res.status(404).send("User not found");
            return;
        }

        //Validate the new values on model
        user.username = username;
        user.surname = surname;

        //If email was changed, then logout and send new confirmation code
        if (email != user.email) {
            user.email = email;
            user.makeActivationCode(30);
            UserController.sendVeryficationEmail(user);
            wasEmailChanged = true;
        }

        const errors = await validate(user);
        if (errors.length > 0) {
            res.status(400).send(errors);
            return;
        }

        //Try to safe, if fails, that means username already in use
        try {
            await userRepository.save(user);
        } catch (e) {
            const error = [{
                constraints: {
                    isEmailUnique: "Istnieje już użytkownik z podanym adresem E-mail"
                }
            }];
            res.status(409).send(error);
            return;
        }

        const data = {
            id: user.id,
            username: user.username,
            surname: user.surname,
            email: user.email
        };

        if (wasEmailChanged) {
            res.status(204).send();
        } else {
            //Refresh access token with new user data
            const accessToken = jwt.sign({ id: user.id, username: user.username, surname: user.surname, email: user.email }, config.jwtSecret, {
                expiresIn: '30m'
            });
            res.setHeader('Authorization', accessToken);
            res.status(201).send(data);
        }
    };

    static deleteUser = async (req: Request, res: Response) => {
        //Get the ID from the url
        const id = req.params.id;

        const userRepository = getRepository(User);
        let user: User;
        try {
            user = await userRepository.findOneOrFail(id);
        } catch (error) {
            res.status(404).send("User not found");
            return;
        }
        userRepository.delete(id);

        //After all send a 204 (no content, but accepted) response
        res.status(204).send();
    };

    static getFriends = async (req: Request, res: Response) => {
        const id = req.params.id;

        const userRepository = getRepository(User);

        let friends;
        try {
            friends = await userRepository.createQueryBuilder("user")
                .leftJoinAndSelect("user.friends", "friends")
                .where("user.id = :id", { id: id })
                .getMany();
        } catch (error) {
            res.status(404).send();
            return;
        }
        let result = [];

        friends.forEach(packet => {
            packet.friends.forEach(friend => {
                const { id, username, surname, role } = friend;
                result.push({
                    id,
                    username,
                    surname,
                    role
                });
            });
        });

        res.json(result);
    };

    static search = async (req: Request, res: Response) => {
        const word = req.body.search;

        const userRepository = getRepository(User);
        let users;
        try {
            users = await userRepository.createQueryBuilder("user")
                .select(["user.username", "user.surname", "user.id"])
                .where("user.username like :word", { word: '%' + word + '%' })
                .orWhere("user.surname like :word", { word: '%' + word + '%' })
                .getMany();
        } catch (error) {
            res.status(404).send(error);
            return;
        }


        res.json(users);
    };

    static saveFriendsRequest = async (req: Request, res: Response) => {
        const userId = res.locals.jwtPayload.id;
        const targetId = req.body.id;
        let newRequest: FriendsRequest = new FriendsRequest();

        newRequest.message = "Testowanie zaproszeń";
        newRequest.requestUserId = userId;
        newRequest.targetUserId = targetId;
        newRequest.status = true;
        newRequest.sendRequest = false;

        const requestRepository = getRepository(FriendsRequest);
        try {
            requestRepository.save(newRequest);
        } catch (err) {
            const error = [{
                constraints: {
                    cannotSendRequest: "Nie udało się wysłać zaproszenia "
                }
            }];
            res.status(409).send(error);
            return;
        }

        res.status(201).send();
    };


    static getRequests = async (req: Request, res: Response) => {
        const userId: number = res.locals.jwtPayload.id;

        const requestRepository = getRepository(FriendsRequest);
        let result = [];
        const friendRequest = await requestRepository.find({ select: ["id", "requestUserId", "createdAt", "message", "status"], where: { targetUserId: userId } })
            .then(fr => { return fr })
            .catch(err => {
                const error = [{
                    constraints: {
                        cannotLoadRequest: "Nie udało się wczytać powiadomień (powiadomienie)"
                    }
                }];
                res.status(409).send(error);
                return Promise.reject(error);
            });

        friendRequest.forEach(async reqData => {
            const userRepository = getRepository(User);
            await userRepository.findOne({ select: ["username", "surname", "avatar"], where: { id: reqData.requestUserId } })
                .then(user => {
                    result.push({
                        requestId: reqData.id,
                        createdAt: reqData.createdAt,
                        message: reqData.message,
                        status: reqData.status,
                        requestUserData: {
                            username: user.username,
                            surname: user.surname,
                            avatar: user.avatar
                        }
                    });
                })
                .catch(err => {
                    const error = [{
                        constraints: {
                            cannotLoadRequest: "Nie udało się wczytać powiadomień (dane użytkownika)"
                        }
                    }];
                    res.status(409).send(error);
                    return;
                });
        });
        console.log(result);
    };

    static friendsRequestDecision = async (req: Request, res: Response) => {
        const { reqID, decision } = req.body;
        const requestRepository = getRepository(FriendsRequest);
        const userRepository = getRepository(User);


        const requestData: FriendsRequest = await requestRepository
            .findOneOrFail({ where: { id: reqID } })
            .then(reqData => {
                return reqData;
            })
            .catch(err => {
                const error = [{
                    constraints: {
                        cannotLoadRequest: "Nie znaleziono zaproszenia."
                    }
                }];
                res.status(404).send(error);
                return Promise.reject(error);
            });

        requestData.status = false;

        await requestRepository.save(requestData);

        if (decision === 'ACCEPT') {
            let requestUser: User;

            try {
                requestUser = await userRepository.findOneOrFail(requestData.requestUserId);
            } catch (err) {
                const error = [{
                    constraints: {
                        canotFindUser: "Nie znaleziono użytkownika."
                    }
                }];
                res.status(404).send(error);
                return;
            }

            let targetUser: User;
            try {
                targetUser = await userRepository.findOneOrFail(res.locals.jwtPayload.id);
            } catch (err) {
                const error = [{
                    constraints: {
                        canotFindUser: "Nie znaleziono użytkownika."
                    }
                }];
                res.status(404).send(error);
                return;
            }

            let currentFriends = requestUser.friends;
            try {
                currentFriends.push(targetUser);
                requestUser.friends = currentFriends;
                console.log(currentFriends);
            } catch (err) {
                const error = [{
                    constraints: {
                        cannotAddFriend: "Coś poszło nie tak. " + err
                    }
                }];
                res.status(409).send(error);
                return;
            }

            await userRepository.save(requestUser);
        }


        /*
    res.status(408).send([{
        constraints: {
            timeOut: "Upłynął czas żądania."
        }
    }]);
    */

        res.status(200).json(requestData);
    };


    static test = async (req: Request, res: Response) => {
        const { val } = req.body;
        res.status(201).send('testuję sobie ' + val);
    };
};

export default UserController;