import RPCInterface from "../server.js";
import Schema, { AccessDeniedError, validateProjectForm } from "../schema.js";
import Project from "../models/project.js";
import { convertProject } from "../convert.js";
import ProjectUser from "../models/projectuser.js";

export default function routesProject(int: RPCInterface) {
  int.onMethod(Schema.projects.getList, async (_, { session }) => {
    const user = await int.getUserById(session.userId, {
      include: [
        { as: "projects", model: Project },
        { as: "ownedProjects", model: Project },
      ],
    });
    return {
      projects: user.projects.map(convertProject),
      ownedProjects: user.ownedProjects.map(convertProject),
    };
  });

  int.onMethodAuthorized(
    Schema.projects.delete,
    async ({ projectId }, { session }) => {
      const project = await int.findById<Project>(Project, projectId);
      if (project.ownerId != session.userId) throw new AccessDeniedError();
      await project.destroy();
    },
  );

  int.onMethod(Schema.projects.create, async (projectform, { session }) => {
    validateProjectForm(projectform);
    const user = await int.getUserById(session.userId);
    const project = await Project.create({
      ...projectform,
      ownerId: user.id,
    });
    await ProjectUser.create({
      projectId: project.id,
      userId: user.id,
    });

    return convertProject(project);
  });
}
