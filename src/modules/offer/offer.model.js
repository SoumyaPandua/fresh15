import mongoose from "mongoose";

const offerSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 150,
        },

        description: {
            type: String,
            default: "",
            trim: true,
            maxlength: 500,
        },

        discount: {
            type: String,
            required: true,
            trim: true,
            maxlength: 50,
        },

        category: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            maxlength: 100,
            index: true,
        },

        isActive: {
            type: Boolean,
            default: true,
            index: true,
        },

        isDeleted: {
            type: Boolean,
            default: false,
            index: true,
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

const Offer = mongoose.model("Offer", offerSchema);

export default Offer;