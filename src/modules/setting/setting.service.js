import Setting from "./setting.model.js";

export const getSettingService = async () => {
    let setting = await Setting.findOne();

    if (!setting) {
        setting = await Setting.create({});
    }

    return setting;
};

export const updateSettingService = async (
    body,
    userId
) => {
    let setting = await Setting.findOne();

    if (!setting) {
        setting = await Setting.create({
            createdBy: userId,
        });
    }

    if (file) {
        setting.logo = file.path;
    }

    Object.keys(body).forEach((key) => {
        if (body[key] !== undefined) {
            setting[key] = body[key];
        }
    });

    setting.updatedBy = userId;

    await setting.save();

    return setting;
};