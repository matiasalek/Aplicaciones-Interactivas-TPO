const { config } = require("../../src/config/env");

const inviteCode = "admin-invite-for-integration-tests";
const authConfig = { ...config.auth, adminInviteCode: inviteCode };

module.exports = { authConfig, inviteCode };
