
import crypto from "crypto";
import RPCInterface from "../server.js";
import Schema, { validateUserForm } from "../schema.js";
import User from "../models/user.js";

export default function routesUser(int: RPCInterface) {
  int.onMethod(Schema.user.register, async (userform, { session }) => {
    validateUserForm(userform);
    const user = await User.create({
      ...userform,
      token: crypto.randomBytes(32).toString("hex"),
    });
    session.userId = user.id;
    return { token: user.token };
  });

  int.onMethod(Schema.user.login, async (userform, { session }) => {
    validateUserForm(userform);
    const user = await User.findOne({
      where: {
        ...userform,
      },
    });
    user.token = crypto.randomBytes(32).toString("hex");
    session.userId = user.id;
    await user.save();
    return { token: user.token };
  });

  int.onMethod(Schema.user.info, async (_, { session }) => {
    const user = await int.getUserById(session.userId);
    return { id: user.id, username: user.username };
  });
}
