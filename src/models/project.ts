import { Column, Table, Model, BelongsTo, HasMany, ForeignKey, BelongsToMany } from "sequelize-typescript";
import User from "./user.js";
import Category from "./category.js";
import ProjectUser from "./projectuser.js";

@Table
export default class Project extends Model {
  @Column
  declare title: string;

  @Column
  declare description: string;

  @Column
  @ForeignKey(() => User)
  declare ownerId: number;

  @BelongsTo(() => User)
  owner: ReturnType<() => User>;

  @BelongsToMany(() => User, () => ProjectUser)
  members: ReturnType<() => User[]>;

  @HasMany(() => Category)
  categories: ReturnType<() => Category[]>;
}
