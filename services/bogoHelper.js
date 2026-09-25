/**
 * BOGO promotion helper
 * Computes promotion quantities based on the trusted product document.
 *
 * @param {Object} product   Mongoose product document (must contain offerType)
 * @param {number} paidQty   Validated paid quantity (positive integer)
 * @returns {Object} Object containing paidQuantity, freeQuantity, physicalQuantity, offerType
 */
export const computePromotionQuantities = (product, paidQty) => {
  const offerType = product.offerType || "NONE";
  let freeQuantity = 0;

  if (offerType === "BUY_1_GET_1") {
    freeQuantity = paidQty; // 1 free for each paid unit
  }

  const physicalQuantity = paidQty + freeQuantity;

  return {
    paidQuantity: paidQty,
    freeQuantity,
    physicalQuantity,
    offerType,
  };
};
