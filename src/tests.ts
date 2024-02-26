import { Client, WebSocketImpl } from "rpc-with-types";
import Service, { ServiceConfig } from "./service.js";
import Schema from "./schema.js";
import { expect } from "chai";

const config: ServiceConfig = {
  rpcOptions: { host: "127.0.0.1", port: 8866 },
  sequelizeOptions: {
    dialect: "sqlite",
    host: ":memory:",
  },
  logLevel: "info",
};

async function serviceAndSocket() {
  const service = await Service.create(config);
  const socket = new Client({
    socket: new WebSocketImpl(`ws://127.0.0.1:${config.rpcOptions.port}`),
  });
  service.rpc.server.debugLoggerSend = (s) => console.log(`Server > ${s}`);
  service.rpc.server.debugLoggerReceive = (s) => console.log(`Server < ${s}`);
  socket.debugLoggerSend = (s) => console.log(`Client > ${s}`);
  socket.debugLoggerReceive = (s) => console.log(`Client < ${s}`);
  await socket.connect();
  return {
    service,
    socket,
  };
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

      const r = (
        await new Schema.user.info().with(socket)
      );
      if (typeof r === "string") throw new Error(r);
      expect(r.username).to.equal("hashelq");
    } finally {
      socket.close();
      service.rpc.server.close();
    }
  });
});
