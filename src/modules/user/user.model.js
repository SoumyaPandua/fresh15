import mongoose from "mongoose";

const authSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },
        phone: {
            type: String,
            default: ""
        },
        password: {
            type: String,
            required: true
        },
        role: {
            type: String,
            enum: ["SUPER_ADMIN", "ADMIN", "PARTNER", "CUSTOMER"],
            default: "CUSTOMER"
        },
        customerTier: {
            type: String,
            enum: ["STANDARD", "VIP"],
            default: "STANDARD",
        },
        portal: {
            type: String,
            enum: ["platform", "partner", "customer"],
            required: true
        },
        profileImage: {
            type: String,
            default: ""
        },
        currentLocation: {
            latitude: {
                type: Number,
                default: null,
            },
            longitude: {
                type: Number,
                default: null,
            },
            updatedAt: {
                type: Date,
                default: null,
            },
        },
        isEmailVerified: {
            type: Boolean,
            default: false
        },
        isActive: {
            type: Boolean,
            default: true
        },
        isOnline: {
            type: Boolean,
            default: false,
        },

        lastSeen: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true
    }
);

export default mongoose.model("User", authSchema);