import "reflect-metadata";
import { createConnection, getRepository } from "typeorm";
import * as express from "express";
import * as http from 'http';
import * as bodyParser from "body-parser";
import * as helmet from "helmet";
import * as cors from "cors";
import routes from "./routes";
import * as swagger from 'swagger-ui-express';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import * as socket_io from 'socket.io';
import * as socketJwt from 'socketio-jwt';
import config from "./config/config";
import FriendsRequest from "./entity/FriendRequest";
import { User } from './entity/User';

let swaggerSpec: Object;
try {
  swaggerSpec = yaml.safeLoad(fs.readFileSync('./swagger.yaml', 'utf8'));
} catch (e) {
  console.log(e);
};


createConnection()
  .then(async connection => {
    const app = express();

    app.use(cors({ exposedHeaders: 'Authorization' }));
    app.use(helmet());
    app.use(bodyParser.json());

    app.use("/", routes);
    app.use('/swagger-ui', swagger.serve, swagger.setup(swaggerSpec));

    const server = http.createServer(app);

    const io = socket_io(server);

    io.on('connection', socketJwt.authorize({
      secret: config.jwtSecret,
      callback: false
    })).on('authenticated', socket => {
      let notificationsInterval = setInterval(async function () {

        const requests = await getRepository(FriendsRequest)
          .createQueryBuilder("friendsRequests")
          .leftJoin("friendsRequests.targetUser", "tUser")
          .leftJoin("friendsRequests.requestUser", "rUser")
          .select([
            "friendsRequests.id",
            "friendsRequests.createdAt",
            "friendsRequests.message",
            "friendsRequests.status",
            "rUser.id",
            "rUser.username",
            "rUser.surname"])
          .where("tUser.id = :targetId", { targetId: socket.decoded_token.id })
          .getMany();


        /*
        requestsRepository.findAndCount({
          select: ["id", "createdAt", "message", "status", "requestUser.id"],
          where: { targetUser: socket.decoded_token.id, status: true, sendRequest: false },
          join: {
            alias: 'request',
            leftJoin: {
              requestUserData: "request.requestUser"
            }
          }
        })
          .then(([friendsRequest, count]) => {
            console.log("sprawdzam, sprawdzam. Spokojnie..." + count + ", dla użytkownika " + socket.decoded_token.username);

            console.log(friendsRequest)
            if (count > 0) {
              
                            let result = [];
                            friendsRequest.forEach(reqData => {
                              const userRepository = getRepository(User);
                              userRepository.findOne({ select: ["username", "surname", "avatar"], where: { id: reqData.requestUser.id } })
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
                                .then(() => {
                                  socket.emit('newNotification', result);
                                })
                            });
              
                            friendsRequest.forEach(request => {
                              request.sendRequest = true;
                              requestsRepository.update(request.id, request);
                            });
                            
            }
          })
          .catch(e => {
            socket.emit('newNotification', { title: 'Wystąpił błąd' + e });
          });
          */
      }, 3000);

      socket.on('disconnect', () => {
        console.log('Rozłączono');
        clearInterval(notificationsInterval);
      });

    });

    app.locals.io = io;

    server.listen(5000, () => {
      console.log("Server is started on port 5000!");
    });

  })
  .catch(error => console.log(error));

