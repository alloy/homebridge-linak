"use strict";
const constants_1 = require("./constants");
const platform_1 = require("./platform");
module.exports = (api) => {
    api.registerPlatform(constants_1.PLATFORM_NAME, platform_1.LinakDeskControlPlatform);
};
//# sourceMappingURL=index.js.map