import { Sequelize, SequelizeOptions } from "sequelize-typescript";
import User from "./models/user.js";
import Project from "./models/project.js";
import Category from "./models/category.js";
import Task from "./models/task.js";
import ProjectUser from "./models/projectuser.js";
import TaskUser from "./models/taskuser.js";

export default function createSequelize(options: SequelizeOptions): Sequelize {
  const seq = new Sequelize({
    ...options,
  });
  seq.addModels([User, Project, ProjectUser, Category, Task, TaskUser]);

  return seq;
}
