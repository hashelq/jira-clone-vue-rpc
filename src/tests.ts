import { Client, WebSocketImpl } from "rpc-with-types";
import Service, { ServiceConfig } from "./service.js";
import Schema from "./schema.js";
import { expect } from "chai";
import WebSocket from "ws";

const config: ServiceConfig = {
  rpcOptions: { host: "127.0.0.1", port: 8866 },
  sequelizeOptions: {
    dialect: "sqlite",
    host: ":memory:",
  },
  logLevel: "debug",
};

async function serviceAndSocket() {
  const service = await Service.create(config);
  const socket = new Client({
    socket: new WebSocketImpl(
      new WebSocket(`ws://127.0.0.1:${config.rpcOptions.port}`),
    ),
  });
  service.rpc.server.debugLoggerSend = (s) =>
    service.logger.debug({
      type: "rpc-raw",
      object: "server",
      direction: "out",
      data: s,
    });
  service.rpc.server.debugLoggerReceive = (s) =>
    service.logger.debug({
      type: "rpc-raw",
      object: "server",
      direction: "in",
      data: s,
    });
  await socket.connect();
  return {
    service,
    socket,
  };
}

function ok<X>(x: string | X): X {
  if (typeof x === "string") throw new Error(x);
  return x;
}

async function userEnvironment() {
  const { service, socket } = await serviceAndSocket();
  const r = await new Schema.user.register({
    username: "hashelq",
    password: "test",
  }).with(socket);
  if (typeof r === "string") throw new Error(r);
  return { service, socket };
}

async function projectEnvironment() {
  const { service, socket } = await userEnvironment();
  const projectName = "Test Project";
  const project = await new Schema.projects.create({
    title: projectName,
    description: "Project for testing",
  }).with(socket);
  if (typeof project === "string") throw new Error(project);
  return { service, socket, project };
}

async function categoryEnvironment() {
  const { service, socket, project } = await projectEnvironment();
  const category = await new Schema.category.create({
    projectId: project.id,
    title: "Testing",
  }).with(socket);
  if (typeof category === "string") throw new Error(category);
  return { service, socket, project, category };
}

describe("User interactions", () => {
  it("User register and get info", async () => {
    const { service, socket } = await serviceAndSocket();
    try {
      const response = ok(
        await new Schema.user.register({
          username: "hashelq",
          password: "test",
        }).with(socket),
      );

      service.logger.info({
        type: "test",
        message: `token: ${response.token}`,
      });
      expect(response.token).to.not.equal(undefined);

      const r = ok(await new Schema.user.info().with(socket));

      expect(r.username).to.equal("hashelq");
    } finally {
      socket.close();
      service.rpc.server.close();
    }
  });

  it("Create project and list", async () => {
    const { service, socket } = await userEnvironment();
    try {
      const projectName = "Test Project";
      ok(
        await new Schema.projects.create({
          title: projectName,
          description: "Project for testing",
        }).with(socket),
      );

      const rlist = ok(await new Schema.projects.getList().with(socket));

      expect(rlist.projects[0].title).to.equal(projectName);
      expect(rlist.ownedProjects[0].title).to.equal(projectName);
    } finally {
      socket.close();
      service.rpc.server.close();
    }
  });

  it('Create category "TEST" and list it', async () => {
    const { service, socket, project } = await projectEnvironment();
    try {
      const category = ok(
        await new Schema.category.create({
          projectId: project.id,
          title: "Testing",
        }).with(socket),
      );
      expect(category.id).to.equal(1);

      const categories = ok(
        await new Schema.category.getList({
          projectId: project.id,
        }).with(socket),
      );
      expect(categories[0].id).to.equal(category.id);
    } finally {
      socket.close();
      service.rpc.server.close();
    }
  });

  it("Tasks interactions", async () => {
    const { service, socket, project, category } = await categoryEnvironment();
    try {
      let task = ok(
        await new Schema.task.create({
          categoryId: category.id,
          task: {
            title: "Hello world",
            description: "Test",
          },
        }).with(socket),
      );
      expect(task.id).to.equal(1);

      let tasks = ok(
        await new Schema.task.getList({
          categoryId: category.id,
        }).with(socket),
      );
      expect(tasks[0].id).to.equal(task.id);

      ok(
        await new Schema.task.edit({
          taskId: task.id,
          task: {
            title: "blabla",
            description: "test2",
            associatedUsers: [1, 999],
          },
        }).with(socket),
      );

      task = ok(
        await new Schema.task.get({
          taskId: task.id,
        }).with(socket),
      );

      expect(task.associatedUsers.length).to.equal(1);
      expect(task.associatedUsers[0].id).to.equal(1);

      // create second category
      const ncat = ok(
        await new Schema.category.create({
          projectId: project.id,
          title: "done",
        }).with(socket),
      );
      ok(
        await new Schema.task.move({
          taskId: task.id,
          categoryId: ncat.id,
        }).with(socket),
      );

      tasks = ok(
        await new Schema.task.getList({
          categoryId: ncat.id,
        }).with(socket),
      );
      expect(tasks.length).to.equal(1);

      const tasks2 = ok(
        await new Schema.task.getList({
          categoryId: category.id,
        }).with(socket),
      );
      expect(tasks2.length).to.equal(0);
    } finally {
      socket.close();
      service.rpc.server.close();
    }
  });
});
