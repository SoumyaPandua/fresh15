import mongoose from "mongoose";

const bannerSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true, maxlength: 150 },
    subtitle: { type: String, default: "", trim: true, maxlength: 300 },
    placement: { type: String, required: true, trim: true, maxlength: 100, index: true },
    image: { type: String, required: true, trim: true },
    imagePublicId: { type: String, default: null },
    isActive: { type: Boolean, default: true, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

const Banner = mongoose.model("Banner", bannerSchema);

export default Banner;