import { Table, Column, Model, HasMany, BelongsToMany } from "sequelize-typescript";
import Project from "./project.js";
import ProjectUser from "./projectuser.js";

@Table
export default class User extends Model {
  @Column
  declare username: string;

  @Column
  declare password: string;

  @HasMany(() => Project)
  ownedProjects: Project[];

  @BelongsToMany(() => Project, () => ProjectUser)
  projects: Project[];

  @Column
  declare token: string;
}
