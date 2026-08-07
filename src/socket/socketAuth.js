import jwt from "jsonwebtoken";
import User from "../modules/user/user.model.js";

const socketAuth = async (socket, next) => {
    try {
        const token =
            socket.handshake.auth?.token ||
            socket.handshake.headers?.authorization?.replace(
                "Bearer ",
                ""
            );

        if (!token) {
            return next(new Error("Authentication failed"));
        }

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        const user = await User.findById(decoded.id);

        if (!user) {
            return next(new Error("User not found"));
        }

        socket.user = user;

        next();
    } catch (error) {
        next(new Error("Unauthorized"));
    }
};

export default socketAuth;