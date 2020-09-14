import { Request, Response } from 'express';
import User from '../entity/User';
import { getRepository } from 'typeorm';
import Chat from '../entity/Chat';

class ChatController {

    static getChatByUserId = async (req: Request, res: Response) => {
        const id: number = +req.params.id;
        const page: number = +req.params.page ? +req.params.page : 0;


        const conversations = await getRepository(Chat)
            .createQueryBuilder("conversations")
            .leftJoin("conversations.users", "user", "NOT user.id = :id", { id: id })
            .select(["conversations", "user.id", "user.username", "user.surname", "user.avatar", "user.role"])
            .take(30)
            .skip(page * 30)
            .getMany()
            .then(res => {
                res.forEach(con => {
                    con.users.forEach(user => {
                        user.avatar = Buffer.from(user.avatar, 'base64').toString();
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

        res.status(200).json(conversations);
    }
};

export default ChatController;