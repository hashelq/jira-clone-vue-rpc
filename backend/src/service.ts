import { Logger, pino } from "pino";
import RPCInterface from "./server.js";
import { Sequelize } from "sequelize";
import { SequelizeOptions } from "sequelize-typescript";
import createSequelize from "./seq.js";
import routesCategory from "./routes/category.js";
import routesProject from "./routes/project.js";
import routesTask from "./routes/task.js";
import routesUser from "./routes/user.js";

export interface ServiceConfig {
  rpcOptions: {
    host: string;
    port: number;
  };
  sequelizeOptions: SequelizeOptions;
  logLevel: string;
}

async function prepareDatabase(logger: Logger, options: SequelizeOptions) {
  logger.info({ type: "component-report", object: "db", state: "connecting" });
  const seq = createSequelize(options);
  logger.info({ type: "component-report", object: "db", state: "syncing" });
  await seq.sync();
  logger.info({ type: "component-report", object: "db", state: "done" });
  return seq;
}

export default class Service {
  public rpc: RPCInterface;
  public seq: Sequelize;
  public logger: Logger;

  private constructor(rpc: RPCInterface, seq: Sequelize, logger: Logger) {
    this.rpc = rpc;
    this.seq = seq;
    this.logger = logger;
  }

  public static async create(config: ServiceConfig) {
    const cs = config.sequelizeOptions;
    const logger = pino({
      level: config.logLevel,
    });
    const seq = await prepareDatabase(logger, {
      dialect: cs.dialect,
      database: cs.database,
      username: cs.username,
      password: cs.password,
      host: cs.host,
      port: cs.port,

      logging:
        config.logLevel === "debug"
          ? (sql: string) => {
              logger.debug({
                type: "component-nested-message",
                object: "db",
                message: sql,
              });
            }
          : false,
    });

    const rpci = new RPCInterface(
      config.rpcOptions.host,
      config.rpcOptions.port,
      logger,
      seq,
    );

    rpci.implementRoutes(routesUser);
    rpci.implementRoutes(routesProject);
    rpci.implementRoutes(routesCategory);
    rpci.implementRoutes(routesTask);

    return new Service(rpci, seq, logger);
  }
}
