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
    socket: new WebSocketImpl(new WebSocket(`ws://127.0.0.1:${config.rpcOptions.port}`)),
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
});
