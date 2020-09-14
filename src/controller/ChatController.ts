import { Request, Response } from 'express';
import { getRepository } from 'typeorm';
import Chat from '../entity/Chat';

class ChatController {

    static getChatByUserId = async (req: Request, res: Response) => {
        const id: number = +req.params.id;
        const page: number = +req.params.page ? +req.params.page : 0;


        const conversations = await getRepository(Chat)
            .createQueryBuilder("conversation")
            .leftJoin("conversation.users", "user")
            .leftJoin("user", "user")
            .select([
                "user.username"
            ])
            .take(30)
            .skip(page * 30)
            .getMany()
            .then(res => Promise.resolve(res))
            .catch(err => {
                const error = [{
                    constraints: {
                        isConversationsFound: "Wystąpił błąd. Nie można pobrać konwersacji."
                    }
                }];
                res.status(409).send(error);
                return Promise.reject(error);
            });

            console.log(conversations);
            res.status(200).json(conversations);
    }
};

export default ChatController;