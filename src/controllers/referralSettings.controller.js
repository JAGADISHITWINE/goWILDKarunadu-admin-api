const referralSettingsService = require("../service/referralSettings.service");

function toNumber(value, fallback = null) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function validatePayload(body = {}) {
  const payload = {
    baseDiscount: toNumber(body.baseDiscount, null),
    bonusDiscount: toNumber(body.bonusDiscount, null),
    bonusParticipantThreshold: toNumber(body.bonusParticipantThreshold, null),
    freeSlotThreshold: toNumber(body.freeSlotThreshold, null),
    freeSlotValue: toNumber(body.freeSlotValue, null),
    isEnabled: body.isEnabled === false || body.isEnabled === 0 ? 0 : 1,
  };

  if (payload.baseDiscount === null || payload.baseDiscount < 0) {
    return { valid: false, message: "baseDiscount must be a positive number" };
  }
  if (payload.bonusDiscount === null || payload.bonusDiscount < 0) {
    return { valid: false, message: "bonusDiscount must be a positive number" };
  }
  if (payload.bonusParticipantThreshold === null || payload.bonusParticipantThreshold < 1) {
    return { valid: false, message: "bonusParticipantThreshold must be at least 1" };
  }
  if (payload.freeSlotThreshold === null || payload.freeSlotThreshold < 1) {
    return { valid: false, message: "freeSlotThreshold must be at least 1" };
  }
  if (payload.freeSlotValue === null || payload.freeSlotValue < 1) {
    return { valid: false, message: "freeSlotValue must be at least 1" };
  }
  if (payload.bonusDiscount < payload.baseDiscount) {
    return { valid: false, message: "bonusDiscount must be greater than or equal to baseDiscount" };
  }

  return { valid: true, payload };
}

async function getReferralSettings(req, res) {
  try {
    const settings = await referralSettingsService.getReferralSettings();
    return res.status(200).json({ success: true, data: settings });
  } catch (error) {
    console.error("Get referral settings error:", error);
    return res.status(500).json({ success: false, message: "Failed to load referral settings" });
  }
}

async function updateReferralSettings(req, res) {
  try {
    const validation = validatePayload(req.body || {});
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.message });
    }
    const adminId = req.user?.id;
    const updated = await referralSettingsService.updateReferralSettings(validation.payload, adminId);
    return res.status(200).json({ success: true, message: "Referral settings updated", data: updated });
  } catch (error) {
    console.error("Update referral settings error:", error);
    return res.status(500).json({ success: false, message: "Failed to update referral settings" });
  }
}

module.exports = {
  getReferralSettings,
  updateReferralSettings,
};
