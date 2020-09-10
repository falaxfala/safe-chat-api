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

        try {
          console.log("sprawdzam, sprawdzam. Spokojnie... dla użytkownika " + socket.decoded_token.username);
          const [requests, count] = await getRepository(FriendsRequest)
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
            .andWhere("friendsRequests.sendRequest = false")
            .getManyAndCount();

          if (count > 0) {
            socket.emit('notification', requests);
          }

          requests.forEach(request => {
            request.sendRequest = true;
            getRepository(FriendsRequest).update(request.id, request);
          });
        } catch (err) {
          socket.emit('newNotification', { title: 'Wystąpił błąd' + err });
        }
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

