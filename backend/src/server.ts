import crypto from "crypto";
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

    this.implementMethods();
  }

  private async guardHserHasAccessToProject(userId: number, projectId: number) {
    const has = await ProjectUser.findOne({ where: { userId, projectId } });
    if (!has) throw new AccessDeniedError();
  }

  private async findById<M extends Model>(
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

  private async getUserById(
    id: number,
    args?: FindOptions<any>,
  ): Promise<User> {
    const user = await User.findOne({ where: { id }, ...(args ?? {}) });
    if (!user) throw new AuthorizationError();

    return user;
  }

  private async getTask(
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

  private async getCategory(
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
            session: source.session,
          });
        }
        try {
          return await func(req, source);
        } catch (error) {
          const err = convertRPCErrorToCode(error);
          if (err)
            return err;
          throw error;
        }
      };
      server.onMethod(method, newfunc);
    }

    function onMethodAuthorized<Req, Res>(
      method: new () => Method<Req, Res | string>,
      func: (
        req: Req,
        source: { id: number; socket: WebSocket; session: SessionType },
      ) => Promise<Res>,
    ) {
      onMethod(method, async (req, source) => {
        if (!source.session.userId) throw new AuthorizationError();
        return await func(req, source);
      });
    }

    // USER
    onMethod(Schema.user.register, async (userform, { session }) => {
      validateUserForm(userform);
      const user = await User.create({
        ...userform,
        token: crypto.randomBytes(32).toString("hex"),
      });
      session.userId = user.id;
      return { token: user.token };
    });

    onMethod(Schema.user.login, async (userform, { session }) => {
      validateUserForm(userform);
      const user = await User.findOne({
        where: {
          ...userform
        }
      });
      user.token = crypto.randomBytes(32).toString("hex");
      session.userId = user.id;
      await user.save();
      return { token: user.token };
    });

    onMethod(Schema.user.info, async (_, { session }) => {
      const user = await this.getUserById(session.userId);
      return { id: user.id, username: user.username };
    });

    // PROJECT
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

    onMethodAuthorized(Schema.projects.delete, async ({ projectId }, { session }) => {
      const project = await this.findById<Project>(Project, projectId);
      if (project.ownerId != session.userId) throw new AccessDeniedError();
      await project.destroy();
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

    // CATEGORY
    onMethod(Schema.category.create, async (newCategoryForm, { session }) => {
      validateNewCategoryForm(newCategoryForm);
      const user = await this.getUserById(session.userId);
      const project = await this.findById<Project>(
        Project,
        newCategoryForm.projectId,
      );
      if (project.ownerId != user.id) throw new AccessDeniedError();

      return convertCategory(
        await Category.create({
          projectId: project.id,
          title: newCategoryForm.title,
        }),
      );
    });

    onMethodAuthorized(Schema.category.getList, async ({ projectId }, { session }) => {
      await this.guardHserHasAccessToProject(session.userId, projectId);

      return (
        await Category.findAll({
          where: {
            projectId: projectId,
          },
        })
      ).map(convertCategory);
    });

    onMethodAuthorized(Schema.category.delete, async ({ categoryId }, { session }) => {
      await (await this.getCategory(session.userId, categoryId)).destroy();
    });

    // TASK
    onMethodAuthorized(Schema.task.getList, async ({ categoryId }, { session }) => {
      return (
        (
          await this.getCategory(session.userId, categoryId, {
            include: [{ as: "tasks", model: Task }],
          })
        ).tasks ?? []
      ).map(convertTask);
    });

    onMethodAuthorized(Schema.task.create, async (newTaskForm, { session }) => {
      validateNewTaskForm(newTaskForm);
      return convertTask(
        await Task.create({
          categoryId: (
            await this.getCategory(session.userId, newTaskForm.categoryId)
          ).id,
          title: newTaskForm.task.title,
          description: newTaskForm.task.description,
        }),
      );
    });

    onMethodAuthorized(Schema.task.get, async ({ taskId }, { session }) => {
      return convertTask(
        await this.getTask(session.userId, taskId, { include: [User] }),
      );
    });

    onMethodAuthorized(Schema.task.delete, async ({ taskId }, { session }) => {
      await (await this.getTask(session.userId, taskId)).destroy();
    });

    onMethodAuthorized(Schema.task.move, async ({ taskId, categoryId }, { session }) => {
      const task = await this.getTask(session.userId, taskId);

      if (
        task.category.projectId !==
        (await this.getCategory(session.userId, categoryId)).projectId
      )
        throw new WrongOperandsError();

      task.categoryId = categoryId;
      await task.save();
    });

    onMethodAuthorized(Schema.task.edit, async (form, { session }) => {
      validateEditTaskForm(form);
      const transaction = await this.seq.transaction();
      const task = await this.getTask(session.userId, form.taskId, {
        transaction,
      });
      task.title = form.task.title;
      task.description = form.task.description;
      await task.save({ transaction });

      // get all from db and remove if they don't belong to the task
      const taskUsers = await TaskUser.findAll({
        where: { taskId: task.id },
        transaction,
      });

      const usersExist = await User.findAll({
        where: {
          id: {
            [Op.in]: form.task.associatedUsers,
          },
        },
      });

      const lset = new Set();
      const rset = new Set();
      const eset = new Set();
      for (const user of usersExist) {
        eset.add(user.id);
      }
      for (const userId of form.task.associatedUsers) {
        if (eset.has(userId)) lset.add(userId);
      }

      for (const row of taskUsers) {
        rset.add(row.userId);
      }

      await Promise.all(
        taskUsers.filter((x) => {
          if (!lset.has(x.userId)) return TaskUser.destroy();
        }),
      );

      await Promise.all(
        form.task.associatedUsers.filter((x) => {
          if (!rset.has(x))
            return TaskUser.create({
              userId: x,
              taskId: task.id,
            });
        }),
      );

      await transaction.commit();

      return convertTask(
        await this.getTask(session.userId, task.id, {
          include: [User],
        }),
      );
    });
  }
}
