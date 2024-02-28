import {
  Column,
  Table,
  Model,
  BelongsTo,
  ForeignKey,
  BelongsToMany,
} from "sequelize-typescript";
import User from "./user.js";
import Category from "./category.js";
import TaskUser from "./taskuser.js";

@Table
export default class Task extends Model {
  @Column
  declare title: string;

  @Column
  declare description: string;

  @Column
  declare status: "active" | "inactive" | "done";

  @BelongsTo(() => Category)
  declare category: ReturnType<() => Category>;

  @ForeignKey(() => Category)
  declare categoryId: number;

  @BelongsToMany(() => User, () => TaskUser)
  declare associatedUsers: User[];
}
