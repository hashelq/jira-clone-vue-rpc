import RPCInterface from "../server.js";
import Schema, {
  AccessDeniedError,
  validateNewCategoryForm,
} from "../schema.js";
import Project from "../models/project.js";
import { convertCategory } from "../convert.js";
import Category from "../models/category.js";

export default function routesCategory(int: RPCInterface) {
  // CATEGORY
  int.onMethod(Schema.category.create, async (newCategoryForm, { session }) => {
    validateNewCategoryForm(newCategoryForm);
    const user = await int.getUserById(session.userId);
    const project = await int.findById<Project>(
      Project,
      newCategoryForm.projectId,
    );
    if (project.ownerId != user.id) throw new AccessDeniedError();

    return convertCategory(
      await Category.create({
        projectId: project.id,
        title: newCategoryForm.title,
      }),
    );
  });

  int.onMethodAuthorized(
    Schema.category.getList,
    async ({ projectId }, { session }) => {
      await int.guardHserHasAccessToProject(session.userId, projectId);

      return (
        await Category.findAll({
          where: {
            projectId: projectId,
          },
        })
      ).map(convertCategory);
    },
  );

  int.onMethodAuthorized(
    Schema.category.delete,
    async ({ categoryId }, { session }) => {
      await (await int.getCategory(session.userId, categoryId)).destroy();
    },
  );
}
