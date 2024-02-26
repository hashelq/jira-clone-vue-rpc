import { Method, iots as t } from "rpc-with-types";
import Validate, { ValidationError, SchemaDefinition } from "validate";

export class AuthorizationError {}

export class CatchValidationError {
  public errors: ValidationError[];

  constructor(errors: ValidationError[]) {
    this.errors = errors;
  }
}

export function validate<X>(schema: SchemaDefinition, obj: X) {
  const errors = new (Validate as any)(schema).validate(obj);
  if (errors.length) throw new CatchValidationError(errors);
}

export function validateUserForm(obj: { username: string; password: string }) {
  validate(
    {
      username: {
        type: String,
        required: true,
        length: { min: 3, max: 32 },
      },
      password: {
        type: String,
        required: true,
        length: { min: 3, max: 32 },
      },
    },
    obj,
  );
}

export const User = t.type({
  username: t.string,
});

export const Task = t.type({
  title: t.string,
  description: t.string,
  status: t.union([
    t.literal("active"),
    t.literal("inactive"),
    t.literal("done"),
  ]),
  associatedUsers: t.array(t.number),
});

export const Category = t.type({
  title: t.string,
  tasks: t.array(Task),
});

export const Project = t.type({
  title: t.string,
  description: t.string,
  owner: User,

  // Members who have access
  members: t.array(User),

  // Users who ever had/have access
  users: t.record(t.number, User),

  categories: t.array(Category),
});

function result<X extends t.Mixed>(x: X) {
  return t.union([x, t.string]);
}

export default {
  errorCodes: {
    internalError: "INTERNAL_ERROR",
    authorizationError: "AUTHORIZATION_ERROR",
    notFound: "NOT_FOUND",
    denied: "ACCESS_DENIED",
    validationError: "VALIDATION_ERROR",
  },

  user: {
    register: Method.new(
      "user.register",
      t.type({
        username: t.string,
        password: t.string,
      }),
      result(
        t.type({
          token: t.string,
        }),
      ),
    ),

    authorize: Method.new("user.authorize", t.string, result(t.undefined)),

    info: Method.new("user.infoGet", t.void, result(User)),

    projectsGet: Method.new(
      "user.projects.get",
      t.void,
      result(t.array(Project)),
    ),
  },

  category: {
    tasksGet: Method.new(
      "category.tasksGet",
      t.type({
        categoryId: t.number,
      }),
      result(t.array(Task)),
    ),

    tasksCreate: Method.new(
      "category.tasksCreate",
      t.type({
        categoryId: t.number,
        task: Task,
      }),
      result(Task),
    ),
  },

  task: {
    taskEdit: Method.new(
      "task.edit",
      t.type({
        taskId: t.number,
        task: Task,
      }),
      result(Task),
    ),
  },
};
