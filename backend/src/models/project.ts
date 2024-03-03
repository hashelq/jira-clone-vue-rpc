import {
  Column,
  Table,
  Model,
  BelongsTo,
  HasMany,
  ForeignKey,
  BelongsToMany,
} from "sequelize-typescript";
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

  @BelongsTo(() => User, { as: "owner" })
  declare owner: ReturnType<() => User>;

  @BelongsToMany(() => User, () => ProjectUser)
  declare members: ReturnType<() => User[]>;

  @HasMany(() => Category, { as: "categories" })
  declare categories: ReturnType<() => Category[]>;
}
