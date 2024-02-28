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

export function validateProjectForm(obj: { title: string, description: string }) {
  validate(
    {
      title: {
        type: String,
        required: true,
        length: { min: 3, max: 64 },
      },
      description: {
        type: String,
        required: true,
        length: { min: 4, max: 1024 },
      },
    },
    obj,
  );
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

function optional<X extends t.Mixed>(x: X) {
  return t.union([x, t.undefined]);
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
  owner: optional(User),

  // Members who have access
  members: optional(t.array(User)),

  // Users who ever had/have access
  users: optional(t.record(t.number, User)),

  categories: optional(t.array(Category)),
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
  },

  projects: {
    getList: Method.new(
      "user.projects.get",
      t.void,
      result(
        t.type({
          projects: t.array(Project),
          ownedProjects: t.array(Project),
        }),
      ),
    ),

    create: Method.new(
      "user.projects.create",
      t.type({
        title: t.string,
        description: t.string,
      }),
      result(Project),
    ),
  },

  category: {
    create: Method.new(
      "category.create",
      t.type({
        projectId: t.number,
        title: t.string
      }),
      Category
    ), 
  },

  task: {
    get: Method.new(
      "category.tasksGet",
      t.type({
        categoryId: t.number,
      }),
      result(t.array(Task)),
    ),

    create: Method.new(
      "category.tasksCreate",
      t.type({
        categoryId: t.number,
        task: Task,
      }),
      result(Task),
    ),

    edit: Method.new(
      "task.edit",
      t.type({
        taskId: t.number,
        task: Task,
      }),
      result(Task),
    ),
  },
};
