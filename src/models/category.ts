import { Column, Table, Model, BelongsTo, HasMany, ForeignKey } from "sequelize-typescript";
import Project from "./project.js";
import Task from "./task.js";

@Table
export default class Category extends Model {
  @Column
  declare title: string;

  @BelongsTo(() => Project)
  declare project: ReturnType<() => Project>;

  @Column
  @ForeignKey(() => Project)
  declare projectId: number;

  @HasMany(() => Task, { as: "tasks" })
  declare tasks: ReturnType<() => Task[]>;
}
