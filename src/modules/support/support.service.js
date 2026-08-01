import Support from "./support.model.js";
import Counter from "../counter/counter.model.js";

export const getAllSupportTicketsService =
    async () => {
        return await Support.find()
            .populate(
                "userId",
                "name email phone"
            )
            .sort({
                createdAt: -1,
            });
    };

export const getMySupportTicketsService =
    async (userId) => {
        return await Support.find({
            userId,
        }).sort({
            createdAt: -1,
        });
    };

export const getSupportTicketByIdService =
    async (id, userId) => {
        const ticket =
            await Support.findOne({
                _id: id,
                userId,
            }).populate(
                "userId",
                "name email phone"
            );

        if (!ticket) {
            throw new Error(
                "Support ticket not found"
            );
        }

        return ticket;
    };

export const createSupportTicketService =
    async (userId, body, files) => {
        const today = new Date();

        const date =
            today.getFullYear().toString() +
            String(today.getMonth() + 1).padStart(2, "0") +
            String(today.getDate()).padStart(2, "0");

        const counter =
            await Counter.findOneAndUpdate(
                {
                    name: `SUP-${date}`,
                },
                {
                    $inc: {
                        sequence: 1,
                    },
                },
                {
                    new: true,
                    upsert: true,
                }
            );

        const ticketNumber = `SUP-${date}-${String(
            counter.sequence
        ).padStart(6, "0")}`;

        const attachments =
            files?.map((file) => ({
                url: file.path,
                publicId: file.filename,
                fileName: file.originalname,
                mimeType: file.mimetype,
                size: file.size,
            })) || [];

        const ticket =
            await Support.create({
                ticketNumber,
                userId,
                subject: body.subject,
                description:
                    body.description,
                attachments,
                category:
                    body.category ||
                    "OTHER",
                priority:
                    body.priority ||
                    "LOW",
                createdBy: userId,
            });

        return await Support.findById(
            ticket._id
        ).populate(
            "userId",
            "name email phone"
        );
    };

export const updateSupportTicketStatusService =
    async (
        id,
        body,
        userId
    ) => {
        const ticket =
            await Support.findById(id);

        if (!ticket) {
            throw new Error(
                "Support ticket not found"
            );
        }

        ticket.status = body.status;

        if (
            body.adminRemark !==
            undefined
        ) {
            ticket.adminRemark =
                body.adminRemark;
        }

        ticket.updatedBy = userId;

        await ticket.save();

        return ticket;
    };

export const deleteSupportTicketService =
    async (id, userId) => {
        const ticket =
            await Support.findOne({
                _id: id,
                userId,
            });

        if (!ticket) {
            throw new Error(
                "Support ticket not found"
            );
        }

        await ticket.deleteOne();

        return;
    };