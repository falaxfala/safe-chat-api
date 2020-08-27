import "reflect-metadata";
import { createConnection } from "typeorm";
import * as express from "express";
import * as bodyParser from "body-parser";
import * as helmet from "helmet";
import * as cors from "cors";
import routes from "./routes";
import * as swagger from 'swagger-ui-express';
import * as yaml from 'js-yaml';
import * as fs from 'fs';

let swaggerSpec: Object;
try {
  swaggerSpec = yaml.safeLoad(fs.readFileSync('./swagger.yaml', 'utf8'));
} catch (e) {
  console.log(e);
};

//Connects to the Database -> then starts the express
createConnection()
  .then(async connection => {
    // Create a new express application instance
    const app = express();

    // Call midlewares
    app.use(cors({ exposedHeaders: 'Authorization' }));
    app.use(helmet());
    app.use(bodyParser.json());

    //Set all routes from routes folder
    app.use("/", routes);
    app.use('/swagger-ui', swagger.serve, swagger.setup(swaggerSpec));

    app.listen(5000, () => {
      console.log("Server started on port 5000!");
    });
  })
  .catch(error => console.log(error));