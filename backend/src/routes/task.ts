import RPCInterface from "../server.js";
import Schema, {
  WrongOperandsError,
  validateEditTaskForm,
  validateNewTaskForm,
} from "../schema.js";
import { convertTask } from "../convert.js";
import Task from "../models/task.js";
import User from "../models/user.js";
import TaskUser from "../models/taskuser.js";
import { Op } from "sequelize";

export default function routesTask(int: RPCInterface) {
  int.onMethodAuthorized(
    Schema.task.getList,
    async ({ categoryId }, { session }) => {
      return (
        (
          await int.getCategory(session.userId, categoryId, {
            include: [{ as: "tasks", model: Task }],
          })
        ).tasks ?? []
      ).map(convertTask);
    },
  );

  int.onMethodAuthorized(Schema.task.create, async (newTaskForm, { session }) => {
    validateNewTaskForm(newTaskForm);
    return convertTask(
      await Task.create({
        categoryId: (
          await int.getCategory(session.userId, newTaskForm.categoryId)
        ).id,
        title: newTaskForm.task.title,
        description: newTaskForm.task.description,
      }),
    );
  });

  int.onMethodAuthorized(Schema.task.get, async ({ taskId }, { session }) => {
    return convertTask(
      await int.getTask(session.userId, taskId, { include: [User] }),
    );
  });

  int.onMethodAuthorized(Schema.task.delete, async ({ taskId }, { session }) => {
    await (await int.getTask(session.userId, taskId)).destroy();
  });

  int.onMethodAuthorized(
    Schema.task.move,
    async ({ taskId, categoryId }, { session }) => {
      const task = await int.getTask(session.userId, taskId);

      if (
        task.category.projectId !==
        (await int.getCategory(session.userId, categoryId)).projectId
      )
        throw new WrongOperandsError();

      task.categoryId = categoryId;
      await task.save();
    },
  );

  int.onMethodAuthorized(Schema.task.edit, async (form, { session }) => {
    validateEditTaskForm(form);
    const transaction = await int.seq.transaction();
    const task = await int.getTask(session.userId, form.taskId, {
      transaction,
    });
    task.title = form.task.title;
    task.description = form.task.description;
    await task.save({ transaction });

    // get all from db and remove if they don't belong to the task
    const taskUsers = await TaskUser.findAll({
      where: { taskId: task.id },
      transaction,
    });

    const usersExist = await User.findAll({
      where: {
        id: {
          [Op.in]: form.task.associatedUsers,
        },
      },
    });

    const lset = new Set();
    const rset = new Set();
    const eset = new Set();
    for (const user of usersExist) {
      eset.add(user.id);
    }
    for (const userId of form.task.associatedUsers) {
      if (eset.has(userId)) lset.add(userId);
    }

    for (const row of taskUsers) {
      rset.add(row.userId);
    }

    await Promise.all(
      taskUsers.filter((x) => {
        if (!lset.has(x.userId)) return TaskUser.destroy();
      }),
    );

    await Promise.all(
      form.task.associatedUsers.filter((x) => {
        if (!rset.has(x))
          return TaskUser.create({
            userId: x,
            taskId: task.id,
          });
      }),
    );

    await transaction.commit();

    return convertTask(
      await int.getTask(session.userId, task.id, {
        include: [User],
      }),
    );
  });
}
