import { Column, ForeignKey, Table, Model } from "sequelize-typescript";
import Project from "./project.js";
import User from "./user.js";

@Table
export default class ProjectUser extends Model {
  @ForeignKey(() => Project)
  @Column
  projectId: number;

  @ForeignKey(() => User)
  @Column
  userId: number;
}
