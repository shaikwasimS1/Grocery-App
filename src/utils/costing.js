/**
 * Core costing & margin calculation logic for FreshTrack POS.
 *
 * === Schema (what each product/sale/wastage record holds) ===
 *
 * INVENTORY record fields:
 *   purchaseQuantity  — how much was bought (e.g. 2)
 *   purchaseUnit      — 'kg' | 'g'
 *   purchasePrice     — total paid (e.g. ₹60)
 *   marginSlabGrams   — the weight unit margin is defined per (e.g. 250 for "per 250g")
 *   marginAmount      — profit desired per slab (e.g. ₹15)
 *   costPerGram       — derived: purchasePrice / totalGrams
 *   costPerSlab       — derived: costPerGram × marginSlabGrams
 *   sellingPricePerSlab — derived: costPerSlab + marginAmount
 *   sellingPricePerKg  — derived: sellingPricePerSlab × (1000 / marginSlabGrams)
 *   currentStockGrams  — decremented on each sale and on wastage write-off
 *
 * SALE record fields:
 *   sold_at           — immutable UTC timestamp generated at commit
 *   productId / productName
 *   gramsSold         — actual grams sold
 *   cogs              — cost of goods sold = gramsSold × costPerGram
 *   revenue           — actual cash received
 *   grossProfit       — revenue − cogs
 *
 * WASTAGE record fields:
 *   wasted_at         — immutable UTC timestamp generated at write-off
 *   productId / productName
 *   gramsWasted       — quantity written off
 *   wastageLoss       — cost value of wasted stock (gramsWasted × costPerGram)
 *   reason            — free text: "expired", "damaged", etc.
 */

/**
 * Derive all cost & pricing figures for a product from its raw inputs.
 * Call this once on add and again on edit.
 *
 * @param {number} purchaseQuantity   e.g. 2
 * @param {'kg'|'g'} purchaseUnit     e.g. 'kg'
 * @param {number} purchasePrice      total cost e.g. 60
 * @param {number} marginSlabGrams    e.g. 250 (margin is defined per 250g)
 * @param {number} marginAmount       e.g. 15 (₹15 profit per 250g slab)
 * @returns {object} computed pricing fields
 */
export function computePricing({ purchaseQuantity, purchaseUnit, purchasePrice, marginSlabGrams, marginAmount }) {
  const totalGrams = purchaseUnit === 'kg' ? purchaseQuantity * 1000 : purchaseQuantity;

  // Cost breakdown
  const costPerGram = purchasePrice / totalGrams;                 // e.g. 60/2000 = 0.03 ₹/g
  const costPerSlab = costPerGram * marginSlabGrams;               // e.g. 0.03×250 = 7.50 per 250g

  // Selling price = cost + margin, scaled per slab
  const sellingPricePerSlab = costPerSlab + marginAmount;          // e.g. 7.50+15 = ₹22.50 per 250g
  const sellingPricePerKg   = sellingPricePerSlab * (1000 / marginSlabGrams); // e.g. 22.5×4 = ₹90/kg

  return {
    totalGrams,
    costPerGram,
    costPerSlab,
    sellingPricePerSlab,
    sellingPricePerKg,
  };
}

/**
 * Calculate sale figures for a given quantity sold.
 *
 * @param {number} gramsSold
 * @param {number} costPerGram        from computePricing
 * @param {number} amountReceived     actual cash collected
 * @returns {{ cogs: number, grossProfit: number }}
 */
export function computeSale({ gramsSold, costPerGram, amountReceived }) {
  const cogs         = gramsSold * costPerGram;           // cost of goods sold
  const grossProfit  = amountReceived - cogs;             // revenue − cogs
  return { cogs, grossProfit };
}

/**
 * Calculate the cost-price value of a wastage write-off.
 * Wastage is ALWAYS valued at cost, never at selling price.
 *
 * @param {number} gramsWasted
 * @param {number} costPerGram
 * @returns {{ wastageLoss: number }}
 */
export function computeWastage({ gramsWasted, costPerGram }) {
  const wastageLoss = gramsWasted * costPerGram;          // e.g. 1000g × 0.03 = ₹30
  return { wastageLoss };
}

/**
 * Build a per-item P&L summary row from all sales + wastage records for one product.
 * Handles BOTH weight-based and packet-based products.
 *
 * Net Result per item = Gross Profit from Sales − Wastage Loss
 *
 * @param {object} product
 * @param {Array}  salesForProduct
 * @param {Array}  wastageForProduct
 * @returns {object} summary row
 */
export function computeItemPnL(product, salesForProduct, wastageForProduct) {
  const isPacket = product.unit_type === 'packet';

  // --- Purchased / Invested ---
  let purchaseLabel = '';
  let purchasePrice = 0;

  if (isPacket) {
    const pkts = product.totalPacketsPurchased || 0;
    const costPkt = product.costPricePerPacket || 0;
    purchasePrice = pkts * costPkt;
    purchaseLabel = `${pkts} pkts`;
  } else {
    const totalGrams = product.purchaseUnit === 'kg'
      ? (product.purchaseQuantity || 0) * 1000
      : (product.purchaseQuantity || 0);
    purchasePrice = product.purchasePrice || 0;
    purchaseLabel = `${(totalGrams / 1000).toFixed(2)} kg`;
  }

  // --- Sales ---
  const revenue     = salesForProduct.reduce((acc, s) => acc + (s.amountReceived || 0), 0);
  const cogs        = salesForProduct.reduce((acc, s) => acc + (s.cogs || 0), 0);
  const grossProfit = revenue - cogs;

  // Sold quantity label
  let soldLabel = '';
  if (isPacket) {
    const pktsSold = salesForProduct.reduce((acc, s) => acc + (s.gramsSold || 0), 0);
    soldLabel = `${pktsSold} pkts`;
  } else {
    const gramsSold = salesForProduct.reduce((acc, s) => acc + (s.gramsSold || 0), 0);
    soldLabel = `${(gramsSold / 1000).toFixed(2)} kg`;
  }

  // --- Wastage ---
  const gramsWasted = wastageForProduct.reduce((acc, w) => acc + (w.gramsWasted || 0), 0);
  const wastageLoss = wastageForProduct.reduce((acc, w) => acc + (w.wastageLoss || 0), 0);
  let wastedLabel = '';
  if (isPacket) {
    wastedLabel = `${gramsWasted} pkts`;
  } else {
    wastedLabel = `${(gramsWasted / 1000).toFixed(2)} kg`;
  }

  // --- Stock Left ---
  let stockLabel = '';
  if (isPacket) {
    stockLabel = `${product.remainingPackets ?? 0} pkts`;
  } else {
    stockLabel = `${((product.currentStockGrams || 0) / 1000).toFixed(2)} kg`;
  }

  const netResult = grossProfit - wastageLoss;

  return {
    productId:      product.id,
    productName:    product.name,
    unit_type:      product.unit_type,
    // display-friendly labels
    purchaseLabel,
    soldLabel,
    wastedLabel,
    stockLabel,
    // numeric values for sorting / totals
    purchasePrice,
    revenue,
    cogs,
    grossProfit,
    wastageLoss,
    netResult,
    // keep legacy kg fields for Excel export (weight items)
    purchasedKg:      isPacket ? null : ((product.purchaseUnit === 'kg' ? (product.purchaseQuantity||0) * 1000 : (product.purchaseQuantity||0)) / 1000).toFixed(2),
    soldKg:           isPacket ? null : (salesForProduct.reduce((a, s) => a + (s.gramsSold||0), 0) / 1000).toFixed(2),
    wastedKg:         isPacket ? null : (gramsWasted / 1000).toFixed(2),
    remainingStockKg: isPacket ? null : ((product.currentStockGrams || 0) / 1000).toFixed(2),
  };
}

