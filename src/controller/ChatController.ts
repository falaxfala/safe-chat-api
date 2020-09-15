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

        /*
                const conversations = await getRepository(Chat)
                    .createQueryBuilder("conversations")
                    .innerJoin("conversations.users", "user", "NOT user.id = :id", { id: id })
                    .select(["conversations", "user.id", "user.username", "user.surname", "user.avatar", "user.role"])
                    .take(30)
                    .skip(page * 30)
                    .getMany()
                    .then(res => {
                        res.forEach(con => {
                            con.users.forEach(user => {
                                user.avatar = Buffer.from(user.avatar, 'base64').toString();
                                if (!user.avatar.length) {
                                    const avatarBitmap = fs.readFileSync('./public/images/profile_default.jpg');
                                    user.avatar = Buffer.from(avatarBitmap).toString('base64');
                                }
                            });
                        });
                        return res;
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
        */
        res.status(200).json(conversations);
    }

    static loadMessages = async (req: Request, res: Response) => {
        const chatId = req.params.id;

        const messages = await getRepository(Chat)
            .createQueryBuilder("conversation")
            .leftJoin("conversation.messages", "messages", "messages.id = :id", { id: chatId })
            .leftJoin("messages.user", "user")
            .select([
                "conversation.id",
                "messages.id",
                "messages.messageText",
                "user.id"])
            .getMany()
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