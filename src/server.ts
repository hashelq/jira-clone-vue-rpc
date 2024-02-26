import crypto from "crypto";
import { Logger } from "pino";
import { iots as t, Server, WebSocketServerImpl, Method } from "rpc-with-types";
import { WebSocketServer } from "ws";
import {
  FindOptions,
  Error as SequelizeError,
  ValidationError as SequelizeValidationError,
} from "sequelize";
import { Sequelize } from "sequelize-typescript";
import Schema, {
  AuthorizationError,
  CatchValidationError,
  validateProjectForm,
  validateUserForm,
} from "./schema.js";
import User from "./models/user.js";
import Project from "./models/project.js";
import ProjectUser from "./models/projectuser.js";

type SessionType = { userId: number | undefined };

const convertProject = (x: Project) => {
  return { title: x.title, description: x.description };
};

export default class RPCInterface {
  public port: number;
  public logger: Logger;
  public seq: Sequelize;
  public server: Server<any, unknown, any, SessionType>;

  constructor(host: string, port: number, logger: Logger, seq: Sequelize) {
    this.port = port;
    this.logger = logger;
    this.seq = seq;

    this.server = new Server<any, unknown, any, any>({
      server: new WebSocketServerImpl(
        new WebSocketServer({ port: port, host }),
      ),
      sessionInit: () => {
        return {
          userId: undefined,
        };
      },
    });

    this.implementMethods();
  }

  private logCritical(error: string) {
    this.logger.error({
      type: "component-critical",
      object: "rpc",
      message: error,
    });
  }

  private async getUserById(
    id: number,
    args?: FindOptions<any>,
  ): Promise<User> {
    const user = await User.findOne({ where: { id }, ...(args ?? {}) });
    if (!user) throw new AuthorizationError();

    return user;
  }

  private async getUser(token: string): Promise<User> {
    const user = await User.findOne({ where: { token } });
    if (!user) throw new AuthorizationError();

    return user;
  }

  private implementMethods() {
    const server = this.server;
    const up = this;
    function onMethod<
      Req,
      CS extends { id: number; socket: WebSocket; session: SessionType },
      Res,
    >(
      method: new () => Method<Req, Res | string>,
      func: (req: Req, source: CS) => Promise<Res>,
    ) {
      const newfunc = async (req: Req, source: CS) => {
        if (up.logger.level === "debug") {
          up.logger.debug({
            type: "component-update/method-call",
            object: "rpc",
            methodName: new method().name,
            req,
            id: source.id,
            session: source.session
          });
        }
        try {
          return await func(req, source);
        } catch (error) {
          console.error(error);
          if (error instanceof CatchValidationError)
            return Schema.errorCodes.validationError;
          if (error instanceof AuthorizationError)
            return Schema.errorCodes.authorizationError;
          if (
            error instanceof SequelizeValidationError ||
            error instanceof SequelizeError
          ) {
            this.logCritical(error.toString());
            return Schema.errorCodes.internalError;
          }

          // FIXME: crashes in tests
          throw error;
        }
      };
      server.onMethod(method, newfunc);
    }

    onMethod(Schema.user.register, async (userform, { session }) => {
      validateUserForm(userform);
      const token = crypto.randomBytes(32).toString("hex");
      const user = await User.create({
        ...userform,
        token,
      });
      session.userId = user.id;
      return { token };
    });

    onMethod(Schema.user.info, async (_, { session }) => {
      const user = await this.getUserById(session.userId);
      return { username: user.username };
    });

    onMethod(Schema.projects.getList, async (_, { session }) => {
      const user = await this.getUserById(session.userId, {
        include: [
          { as: "projects", model: Project },
          { as: "ownedProjects", model: Project },
        ],
      });
      return {
        projects: user.projects.map(convertProject),
        ownedProjects: user.ownedProjects.map(convertProject),
      };
    });

    onMethod(Schema.projects.create, async (projectform, { session }) => {
      validateProjectForm(projectform);
      const user = await this.getUserById(session.userId);
      const project = await Project.create({
        ...projectform,
        ownerId: user.id,
      });
      await ProjectUser.create({
        projectId: project.id,
        userId: user.id,
      });

      return convertProject(project);
    });
  }
}
