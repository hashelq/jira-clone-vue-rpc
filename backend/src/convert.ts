import User from "./models/user.js";
import Task from "./models/task.js";
import Project from "./models/project.js";
import Category from "./models/category.js";

export function convertUser(x: User) {
  return { id: x.id, username: x.username };
};

export function convertProject(x: Project) {
  return { id: x.id, title: x.title, description: x.description };
};

export function convertTask(x: Task) {
  return {
    id: x.id,
    title: x.title,
    description: x.description,
    associatedUsers: (x.associatedUsers ?? []).map(convertUser),
  };
};

export function convertCategory(x: Category) {
  return {
    id: x.id,
    title: x.title,
    tasks: x.tasks ? x.tasks.map(convertTask) : [],
  };
};
