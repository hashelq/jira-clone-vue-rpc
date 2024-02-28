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
  //socket.debugLoggerSend = (s) =>
  //  service.logger.debug({
  //    type: "rpc-raw",
  //    object: "socket",
  //    direction: "out",
  //    data: s,
  //  });
  //socket.debugLoggerReceive = (s) =>
  //  service.logger.debug({
  //    type: "rpc-raw",
  //    object: "socket",
  //    direction: "in",
  //    data: s,
  //  });
  await socket.connect();
  return {
    service,
    socket,
  };
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
      const response = await new Schema.user.register({
        username: "hashelq",
        password: "test",
      }).with(socket);

      if (typeof response === "string") throw new Error(response);

      service.logger.info({
        type: "test",
        message: `token: ${response.token}`,
      });

      expect(response.token).to.not.equal(undefined);

      const r = await new Schema.user.info().with(socket);
      if (typeof r === "string") throw new Error(r);
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
      const rp = await new Schema.projects.create({
        title: projectName,
        description: "Project for testing",
      }).with(socket);
      if (typeof rp === "string") throw new Error(rp);

      const rlist = await new Schema.projects.getList().with(socket);
      if (typeof rlist === "string") throw new Error(rlist);

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
      const category = await new Schema.category.create({
        projectId: project.id,
        title: "Testing",
      }).with(socket);
      if (typeof category === "string") throw new Error(category);
      expect(category.id).to.equal(1);

      const categories = await new Schema.category.getList({
        projectId: project.id,
      }).with(socket);
      if (typeof categories === "string") throw new Error(categories);
      expect(categories[0].id).to.equal(category.id);
    } finally {
      socket.close();
      service.rpc.server.close();
    }
  });

  it("Tasks interactions", async () => {
    const { service, socket, category } = await categoryEnvironment();
    try {
      const task = await new Schema.task.create({
        categoryId: category.id,
        task: {
          title: "Hello world",
          description: "Test",
        },
      }).with(socket);
      if (typeof task === "string") throw new Error(task);
      expect(task.id).to.equal(1);

      const tasks = await new Schema.task.getList({
        categoryId: category.id,
      }).with(socket);
      if (typeof tasks === "string") throw new Error(tasks);
      expect(tasks[0].id).to.equal(task.id);
    } finally {
      socket.close();
      service.rpc.server.close();
    }
  });
});
