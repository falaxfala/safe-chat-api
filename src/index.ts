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
      setInterval(() => {
        const requestsRepository = getRepository(FriendsRequest);
        requestsRepository.findAndCount({ select: ["id", "createdAt", "status", "requestUserId"], where: { targetUserId: socket.decoded_token.id, status: true } })
          .then(([friendsRequest, count]) => {
            console.log("sprawdzam, sprawdzam. Spokojnie..." + count);
            if (count > 0) {
              socket.emit('newNotification', { title: 'Nowe zaproszenie do znajomych', data: friendsRequest });
            }
          })
          .catch(e => {
            socket.emit('newNotification', { title: 'Wystąpił błąd' + e });
          });
      }, 3000);
    });

    app.locals.io = io;

    server.listen(5000, () => {
      console.log("Server is started on port 5000!");
    });

  })
  .catch(error => console.log(error));

