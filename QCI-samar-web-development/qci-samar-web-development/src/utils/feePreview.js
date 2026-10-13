/**
 * Preview of what a fee configuration will charge, for the system-admin fee screens.
 *
 * Deliberately excludes TDS. `fee_configurations` stores only `tds_enabled`, not a
 * rate — the applicant elects 2% or 10% themselves at payment time — so a preview
 * that baked in a rate showed admins a figure no applicant is ever charged.
 *
 * This is a display aid only. The amount actually charged is resolved server-side
 * and quoted by GET /applications/{id}/fee.
 *
 * @param {number|string} baseFee - Base certification fee
 * @param {number|string} foodAccommodation - Logistics fee
 * @param {number|string} gstPercentage - GST rate as a percentage
 * @returns {string} Payable amount including GST, to 2 decimal places
 */
export const calculatePreviewPayable = (baseFee, foodAccommodation, gstPercentage) => {
  const base = Number(baseFee) || 0;
  const food = Number(foodAccommodation) || 0;
  const gst = Number(gstPercentage) || 0;

  const subtotal = base + food;

  return (subtotal + (subtotal * gst) / 100).toFixed(2);
};
