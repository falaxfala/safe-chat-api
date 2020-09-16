import { Request, Response } from 'express';
import User from '../entity/User';
import { getRepository } from 'typeorm';
import Chat from '../entity/Chat';
import * as fs from 'fs';

class ChatController {

    static getChatByUserId = async (req: Request, res: Response) => {
        const userID: number = +req.params.id;
        const page: number = +req.params.page ? +req.params.page : 0;

        const conversations = await getRepository(User)
            .createQueryBuilder("user")
            .where("user.id = :id", { id: userID })
            .leftJoin("user.conversations", "conversations")
            .limit(30)
            .offset(page * 30)
            .leftJoin("conversations.users", "otherUsers")
            .select([
                "user.id",
                "conversations",
                "otherUsers.id",
                "otherUsers.avatar",
                "otherUsers.username",
                "otherUsers.surname"
            ])
            .getOne()
            .then(res => {
                const { conversations } = res;
                conversations.forEach(elem => {
                    let { users } = elem;

                    if (!elem.conversationName) {
                        delete elem.conversationName;
                    }

                    users = users.filter(user => user.id != userID);
                    users.forEach(user => {
                        user.avatar = Buffer.from(user.avatar, 'base64').toString();
                        if (!user.avatar.length) {
                            const avatarBitmap = fs.readFileSync('./public/images/profile_default.jpg');
                            user.avatar = Buffer.from(avatarBitmap).toString('base64');
                        }
                    });
                    elem.users = users;
                });
                return conversations;
            })
            .catch(err => {
                const error = [{
                    constraints: {
                        isConversationsFound: "Wystąpił błąd. Nie można pobrać konwersacji. " + err
                    }
                }];
                res.status(409).send(error);
                return Promise.reject(error);
            });
        res.status(200).json(conversations);
    }

    static loadMessages = async (req: Request, res: Response) => {
        const chatId = req.params.id;

        const messages = await getRepository(Chat)
            .createQueryBuilder("conversation")
            .where("conversation.id = :id", {id:chatId})
            .leftJoin("conversation.messages", "messages")
            .leftJoin("messages.user", "user")
            .select([
                "conversation.id",
                "messages.id",
                "messages.messageText",
                "user.id"])
            .getOne()
            .then(res => Promise.resolve(res))
            .catch(err => {
                const error = [{
                    constraints: {
                        isConversationsFound: "Wystąpił błąd. Nie można pobrać konwersacji. " + err
                    }
                }];
                res.status(409).send(error);
                return Promise.reject(error);
            });

        res.status(200).json(messages);
    };
};

export default ChatController;