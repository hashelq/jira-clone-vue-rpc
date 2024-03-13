import {
  Error as SequelizeError,
  ValidationError as SequelizeValidationError,
} from "sequelize";

import Schema, {
  AccessDeniedError,
  AuthorizationError,
  CatchValidationError,
  ModelNotFoundError,
  WrongOperandsError,
} from "./schema.js";

export function convertRPCErrorToCode(error: any) {
  console.error(error);
  if (error instanceof WrongOperandsError)
    return Schema.errorCodes.wrongOperands;
  if (error instanceof CatchValidationError)
    return Schema.errorCodes.validationError;
  if (error instanceof AccessDeniedError) return Schema.errorCodes.denied;

  if (error instanceof AuthorizationError)
    return Schema.errorCodes.authorizationError;
  if (error instanceof ModelNotFoundError) return Schema.errorCodes.notFound;

  if (
    error instanceof SequelizeValidationError ||
    error instanceof SequelizeError
  ) {
    this.logCritical(error.toString());
    return Schema.errorCodes.internalError;
  }
}
