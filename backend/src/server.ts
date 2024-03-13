import { Logger } from "pino";
import { Server, WebSocketServerImpl, Method } from "rpc-with-types";
import { WebSocketServer } from "ws";
import {
  Attributes,
  FindOptions,
  Op,
  Error as SequelizeError,
  ValidationError as SequelizeValidationError,
} from "sequelize";
import { Model, Sequelize } from "sequelize-typescript";
import Schema, {
  AccessDeniedError,
  AuthorizationError,
  ModelNotFoundError,
  WrongOperandsError,
  validateEditTaskForm,
  validateNewCategoryForm,
  validateNewTaskForm,
  validateProjectForm,
  validateUserForm,
} from "./schema.js";
import User from "./models/user.js";
import Project from "./models/project.js";
import ProjectUser from "./models/projectuser.js";
import Category from "./models/category.js";
import Task from "./models/task.js";
import TaskUser from "./models/taskuser.js";
import { convertProject, convertTask, convertCategory } from "./convert.js";
import { convertRPCErrorToCode } from "./utils.js";

type SessionType = { userId: number | undefined };

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
  }

  public async guardHserHasAccessToProject(userId: number, projectId: number) {
    const has = await ProjectUser.findOne({ where: { userId, projectId } });
    if (!has) throw new AccessDeniedError();
  }

  public async findById<M extends Model>(
    model: {
      findOne(options?: FindOptions<Attributes<M>>): Promise<M | null>;
    },
    id: number,
    args?: FindOptions<any>,
  ): Promise<M> {
    const obj = await model.findOne({ where: { id }, ...(args ?? {}) });
    if (!obj) throw new ModelNotFoundError();
    return obj;
  }

  public async getUserById(
    id: number,
    args?: FindOptions<any>,
  ): Promise<User> {
    const user = await User.findOne({ where: { id }, ...(args ?? {}) });
    if (!user) throw new AuthorizationError();

    return user;
  }

  public async getTask(
    userId: number,
    postId: number,
    args?: FindOptions<any>,
  ): Promise<Task> {
    const task = await Task.findOne({
      ...args,
      where: {
        id: postId,
      },
      include: [
        { as: "category", model: Category },
        ...(args && args.include && args.include instanceof Array
          ? args.include
          : []),
      ],
    });

    if (!task) throw new AccessDeniedError();
    await this.guardHserHasAccessToProject(userId, task.category.projectId);
    return task;
  }

  public async getCategory(
    userId: number,
    categoryId: number,
    args?: FindOptions<any>,
  ): Promise<Category> {
    const category = await Category.findOne({
      where: {
        id: categoryId,
      },
      ...args,
    });

    if (!category) throw new AccessDeniedError();
    await this.guardHserHasAccessToProject(userId, category.projectId);
    return category;
  }

  public onMethod<
    Req,
    CS extends { id: number; socket: WebSocket; session: SessionType },
    Res,
  >(
    method: new () => Method<Req, Res | string>,
    func: (req: Req, source: CS) => Promise<Res>,
  ) {
    const server = this.server;
    const up = this;
    const newfunc = async (req: Req, source: CS) => {
      if (up.logger.level === "debug") {
        up.logger.debug({
          type: "component-update/method-call",
          object: "rpc",
          methodName: new method().name,
          req,
          id: source.id,
          session: source.session,
        });
      }
      try {
        return await func(req, source);
      } catch (error) {
        const err = convertRPCErrorToCode(error);
        if (err) return err;
        throw error;
      }
    };
    server.onMethod(method, newfunc);
  }

  public onMethodAuthorized<Req, Res>(
    method: new () => Method<Req, Res | string>,
    func: (
      req: Req,
      source: { id: number; socket: WebSocket; session: SessionType },
    ) => Promise<Res>,
  ) {
    this.onMethod(method, async (req, source) => {
      if (!source.session.userId) throw new AuthorizationError();
      return await func(req, source);
    });
  }

  public implementRoutes(x: (t: RPCInterface) => void) {   
    x(this); 
  }
}
