import { Column, ForeignKey, Table, Model } from "sequelize-typescript";
import User from "./user.js";
import Task from "./task.js";

@Table
export default class TaskUser extends Model {
  @ForeignKey(() => Task)
  @Column
  taskId: number;

  @ForeignKey(() => User)
  @Column
  userId: number;
}
