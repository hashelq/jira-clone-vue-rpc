import { pino } from "pino";
import RPCInterface from "./server.js";
import Service from "./service.js";

function envRequired(name: string) {
  const object = process.env[name];
  if (!object) throw new Error(`Environment variable ${name} is required`);
  return object;
}

function envINTRequired(name: string) {
  const env = envRequired(name);
  const value = parseInt(env);
  if (isNaN(value))
    throw new Error(`Environment variable ${name} must be an integer`);
  return value;
}

async function main() {
  // dotenv
  (await import("dotenv")).config();

  // logger/sequelize
  const logLevel = process.env["LOG_LEVEL"] ?? "info"; 
  const [dialect, database, username, password, host, rhost] = [
    "DB_DIALECT",
    "DB_NAME",
    "DB_USERNAME",
    "DB_PASSWORD",
    "DB_HOST",
    "RPC_HOST"
  ].map(envRequired);
  const [sport, rport] = ["DB_PORT", "RPC_PORT"].map(envINTRequired); 

  const service = await Service.create({
    rpcOptions: { host: rhost, port: rport },
    sequelizeOptions: {dialect: dialect as any, database, username, password, host, port: sport},
    logLevel
  });
}

main();
