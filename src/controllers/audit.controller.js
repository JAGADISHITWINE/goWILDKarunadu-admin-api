const { encrypt } = require("../service/cryptoHelper");
const auditService = require("../service/audit.service");

async function getAuditLogs(req, res) {
  try {
    const limit = req.query?.limit || 50;
    const logs = await auditService.getAuditLogs(limit);

    const encryptedResponse = encrypt({
      success: true,
      logs,
      count: logs.length,
    });

    return res.status(200).json({ success: true, data: encryptedResponse });
  } catch (error) {
    console.error("Audit log fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch audit logs",
    });
  }
}

module.exports = {
  getAuditLogs,
};
