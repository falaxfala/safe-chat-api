import { Request, Response, request } from "express";
import { getRepository } from "typeorm";
import { validate } from "class-validator";

import User from "../entity/User";
import config from '../config/config';
import * as jwt from 'jsonwebtoken';
import FriendsRequest from "../entity/FriendRequest";
import { checkJwt } from "../middlewares/checkJwt";
import * as fs from 'fs';
import Chat from "../entity/Chat";

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
        let user: User;
        try {
            user = await userRepository.findOneOrFail(id, {
                select: ["id", "username", "surname", "email", "role", "avatar", "createdAt"] //We dont want to send the password on response
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

        if (!Buffer.from(user.avatar).length) {
            const avatarBitmap = fs.readFileSync('./public/images/profile_default.jpg');
            user.avatar = Buffer.from(avatarBitmap).toString('base64');
            res.json(user);
            return;
        }

        user.avatar = Buffer.from(user.avatar, 'base64').toString();
        res.json(user);
    };

    static getUserAvatar = async (req: Request, res: Response) => {
        const userID: number = +req.params.id;
        const userRepository = getRepository(User);

        const avatarQuery = await userRepository.findOneOrFail(userID, { select: ["avatar"] })
            .then(res => {
                return Buffer.from(res.avatar, 'base64').toString();
            })
            .catch(err => {
                const error = [{
                    constraints: {
                        isAvatarLoaded: "Nie udało się wczytać avatara użytkownika."
                    }
                }];
                res.status(409).send(error);
                return Promise.reject(error);
            });

        if (!avatarQuery.length) {
            const avatarBitmap = fs.readFileSync('./public/images/profile_default.jpg');
            const result = Buffer.from(avatarBitmap).toString('base64');
            res.status(200).send(result);
            return;
        }

        res.status(200).send(avatarQuery);
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

        try {
            //Send veryfication email
            await UserController.sendVeryficationEmail(user);
        } catch (err) {

        }

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
        const userID: number = +req.params.id;

        const friends: User[] = await UserController.loadFriendsObject(userID);
        friends.forEach(friend => {
            friend.avatar = Buffer.from(friend.avatar, 'base64').toString();
        });

        res.json(friends);
    };

    static search = async (req: Request, res: Response) => {
        const word = req.body.search;
        const userID = res.locals.jwtPayload.id;

        const userRepository = getRepository(User);
        let users;
        try {
            users = await userRepository.createQueryBuilder("user")
                .select(["user.username", "user.surname", "user.id"])
                .where("user.username like :word", { word: '%' + word + '%' })
                .orWhere("user.surname like :word", { word: '%' + word + '%' })
                .andWhere("NOT user.id = :id", { id: userID })
                .getMany();
        } catch (err) {

            const error = [{
                constraints: {
                    cannotFindUser: "Nie znaleziono użytkowników"
                }
            }];

            res.status(404).send(error);
            return;
        }


        res.json(users);
    };

    static saveFriendsRequest = async (req: Request, res: Response) => {
        const userId = res.locals.jwtPayload.id;
        const targetId = req.body.id;
        let newRequest: FriendsRequest = new FriendsRequest();

        let requestUser = new User();
        let targetUser = new User();
        const userRepository = getRepository(User);

        try {
            requestUser = await userRepository.findOneOrFail(userId);
            targetUser = await userRepository.findOneOrFail(targetId);
        } catch (err) {
            const error = [{
                constraints: {
                    cannotSendRequest: "Nie znaleziono użytkowników"
                }
            }];
            res.status(404).send(error);
            return;
        }

        newRequest.message = "Testowanie zaproszeń";
        newRequest.requestUser = requestUser;
        newRequest.targetUser = targetUser;
        newRequest.status = true;
        newRequest.sendRequest = false;
        newRequest.seen = false;

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

        let requests: FriendsRequest[];

        try {
            requests = await getRepository(FriendsRequest)
                .createQueryBuilder("friendsRequests")
                .leftJoin("friendsRequests.targetUser", "tUser")
                .leftJoin("friendsRequests.requestUser", "rUser")
                .select([
                    "friendsRequests.id",
                    "friendsRequests.createdAt",
                    "friendsRequests.message",
                    "friendsRequests.status",
                    "friendsRequests.seen",
                    "rUser.id",
                    "rUser.username",
                    "rUser.surname"])
                .where("tUser.id = :targetId", { targetId: userId })
                .getMany();
        } catch (err) {
            const error = [{
                constraints: {
                    cannotLoadRequest: "Nie udało się wczytać powiadomień (powiadomienie)"
                }
            }];
            res.status(409).send(error);
            return;
        }

        requests.forEach(async elem => {
            if (elem.sendRequest === false) {
                elem.sendRequest = true;
                await getRepository(FriendsRequest)
                    .update(elem.id, elem);
            }
        });

        res.status(200).send(requests);
    };

    static friendsRequestDecision = async (req: Request, res: Response) => {
        const { reqID, decision } = req.body;
        const requestRepository = getRepository(FriendsRequest);
        const userRepository = getRepository(User);
        const currentUserId = res.locals.jwtPayload.id;

        if (decision === 'ACCEPT') {
            //LOAD USER DATA FROM REQUEST ID
            const requestUser = await requestRepository
                .createQueryBuilder("request")
                .leftJoin("request.requestUser", "requestUser", "request.id = :reqID", { reqID: reqID })
                .select([
                    "request.id",
                    "requestUser.id"
                ])
                .getOne()
                .then(res => {
                    return res.requestUser;
                })
                .catch(err => {
                    const error = [{
                        constraints: {
                            cannotLoadRequest: "Nie udało się wczytać powiadomień (Użytkownik)" + err
                        }
                    }];
                    res.status(404).send(error);
                    return Promise.reject(error);
                });

            //LOAD CURRENT USER DATA
            let currentUser: User;
            try {
                currentUser = await userRepository.findOneOrFail(currentUserId);
            } catch (err) {
                const error = [{
                    constraints: {
                        cannotLoadRequest: "Nie udało się wczytać obecnego użytkownika"
                    }
                }];
                res.status(404).send(error);
                return;
            }

            //LOAD REQUEST USER CONVERSATIONS ARRAY
            const requestUserConversations = await userRepository
                .createQueryBuilder("user")
                .where("user.id = :id", { id: requestUser.id })
                .leftJoinAndSelect("user.conversations", "conv")
                .getOne()
                .then(res => {
                    return res.conversations;
                })
                .catch(err => {
                    const error = [{
                        constraints: {
                            cannotLoadRequest: "Nie udało się wczytać konwersacji" + err
                        }
                    }];
                    res.status(404).send(error);
                    return Promise.reject(error);
                });

            //LOAD CURRENT USER CONVERSATIONS ARRAY
            const currentUserConversations = await userRepository
                .createQueryBuilder("user")
                .where("user.id = :id", { id: currentUser.id })
                .leftJoinAndSelect("user.conversations", "conv")
                .getOne()
                .then(res => {
                    return res.conversations;
                })
                .catch(err => {
                    const error = [{
                        constraints: {
                            cannotLoadRequest: "Nie udało się wczytać konwersacji" + err
                        }
                    }];
                    res.status(404).send(error);
                    return Promise.reject(error);
                });

            //LOAD REQUEST USER FRIENDS LIST
            const requestUserFriends = await UserController.loadFriendsObject(requestUser.id);

            //SAVE ALL DATA
            const chat = new Chat();
            chat.users = [currentUser, requestUser];

            currentUserConversations.push(chat);
            requestUserConversations.push(chat);

            requestUser.conversations = requestUserConversations;
            currentUser.conversations = currentUserConversations;

            requestUserFriends.push(currentUser);
            requestUser.friends = requestUserFriends;

            await getRepository(Chat).save(chat);
            await userRepository.save(requestUser);
            await userRepository.save(currentUser);
        }

        requestRepository.update(reqID, {status: false});
        res.status(200).send();
    };

    static loadFriendsObject = async (userID: number) => {
        const userRepository = getRepository(User);

        let friends: User[];
        try {
            friends = await userRepository.
                query("SELECT friend.username, friend.surname, friend.id, friend.email, friend.avatar FROM user_friends_user AS rel INNER JOIN user AS friend ON (rel.userId_1 = friend.id AND rel.userId_2 = " + userID + ") OR (rel.userId_2 = friend.id AND rel.userId_1 = " + userID + ")");
        } catch (error) {
            return error;
        }
        return friends;
    };

    static checkFriendshipStatus = async (req: Request, res: Response) => {
        const userId = res.locals.jwtPayload.id;
        const checkUserId: number = +req.params.id;

        const reqRepository = getRepository(FriendsRequest);

        let myRequestsCount = 0;
        let friendshipStatus = '';
        //Check if current User send any requests
        try {
            myRequestsCount = await reqRepository
                .createQueryBuilder("req")
                .where("status = 1 AND (requestUserId = :currUser AND targetUserId = :checkUser) OR (requestUserId = :checkUser AND targetUserId = :currUser)", { currUser: userId, checkUser: checkUserId })
                .getCount();
            //.query("SELECT COUNT(*) FROM friends_request AS request WHERE request.status = 1 AND (request.requestUserId = " + userId + " AND request.targetUserId = " + checkUserkId + ") OR (request.requestUserId = " + checkUserkId + " AND request.targetUserId = " + userId + ")")

        } catch (err) {
            const error = [{
                constraints: {
                    cannotGetUsersRequests: "Nie można pobrać danych użytkownika 1 " + err
                }
            }];
            res.status(409).send(error);
            return;
        }

        const friendsAlready = await UserController.loadFriendsObject(userId)
            .then(f => {
                var result = false;
                f.forEach(elem => {
                    if (elem.id === checkUserId) {
                        result = true;
                        console.log(typeof (checkUserId))
                    }
                });
                return result;
            })
            .catch(err => {
                const error = [{
                    constraints: {
                        cannotGetUsersRequests: "Nie można pobrać danych użytkownika 2 " + err
                    }
                }];
                res.status(409).send(error);
            })

        friendshipStatus = 'NOT_A_FRIENDS';

        if (myRequestsCount === 1) {
            friendshipStatus = 'REQUEST_SENDED';
        }

        if (friendsAlready) {
            friendshipStatus = 'ALREADY_FRIENDS';
        }

        res.status(200).json({ friendshipStatus });
    };

    static markNotificationsSeen = async (req: Request, res: Response) => {
        const notIds: number[] = req.body.ids;
        const requestRepository = getRepository(FriendsRequest);
        let result;
        try {
            await requestRepository.createQueryBuilder()
                .update(FriendsRequest)
                .set({ seen: true })
                .where("id IN (:...ids)", { ids: notIds })
                .execute();
        } catch (err) {
            const error = [{
                constraints: {
                    cannotUpdateNotifications: "Nie udało się zaktualizować stanu powiadomień."
                }
            }];
            res.status(409).send(error);
            return;
        }
        console.log(result);
        res.status(200).send(notIds);
    };
};

export default UserController;