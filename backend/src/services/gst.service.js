import GstRule from '../models/GstRule.model.js';
import Product from '../models/Product.model.js';

/**
 * Rounds a number to two decimal places
 */
const roundToTwo = (num) => parseFloat((Math.round(num * 100) / 100).toFixed(2));

/**
 * Resolves the effective GST rate and HSN Code for a product based on priority:
 * Product override -> Category GST -> Global GST -> Fallback 18%
 */
export const getEffectiveGstRate = async (productId, categoryId) => {
    // 1. Check Product collection directly (Seller product GST source of truth)
    if (productId) {
        const product = await Product.findById(productId).select('taxRate hsnCode').lean();
        if (product && typeof product.taxRate === 'number') {
            return {
                rate: product.taxRate,
                hsnCode: product.hsnCode || '',
                ruleId: null,
                ruleType: 'seller_product'
            };
        }
    }

    let resolvedRule = null;

    // 2. Category level rule fallback
    if (categoryId) {
        resolvedRule = await GstRule.findOne({
            type: 'category',
            categoryId,
            isActive: true
        }).lean();
    }

    // 3. Global level default fallback
    if (!resolvedRule) {
        resolvedRule = await GstRule.findOne({
            type: 'global',
            isActive: true
        }).lean();
    }

    if (resolvedRule) {
        return {
            rate: resolvedRule.rate,
            hsnCode: resolvedRule.hsnCode || '',
            ruleId: resolvedRule._id,
            ruleType: resolvedRule.type
        };
    }

    // 4. Default fallback if no database rules configured
    return {
        rate: 18,
        hsnCode: '',
        ruleId: null,
        ruleType: 'default_fallback'
    };
};

/**
 * Calculates GST components from pricing and rate
 */
export const calculateGst = (price, rate, taxIncluded = false) => {
    const r = Number(rate) || 0;
    const p = Number(price) || 0;

    let basePrice = p;
    let gstAmount = 0;
    let totalPrice = p;

    if (taxIncluded) {
        basePrice = p / (1 + r / 100);
        gstAmount = p - basePrice;
        totalPrice = p;
    } else {
        basePrice = p;
        gstAmount = p * (r / 100);
        totalPrice = p + gstAmount;
    }

    return {
        basePrice: roundToTwo(basePrice),
        gstAmount: roundToTwo(gstAmount),
        totalPrice: roundToTwo(totalPrice),
        rate: r
    };
};

/**
 * Calculates GST components for a set of items during checkout
 */
export const calculateOrderGst = async (items) => {
    let totalSubtotal = 0;
    let totalTax = 0;
    
    const enrichedItems = await Promise.all(
        items.map(async (item) => {
            const product = await Product.findById(item.productId).select('categoryId taxIncluded').lean();
            const categoryId = product?.categoryId || item.categoryId || null;
            const taxIncluded = product?.taxIncluded || false;

            const { rate, hsnCode, ruleType } = await getEffectiveGstRate(item.productId, categoryId);
            
            // Calculate GST based on unit price
            const calc = calculateGst(item.price, rate, taxIncluded);
            const lineGstAmount = calc.gstAmount * item.quantity;
            
            totalSubtotal += calc.basePrice * item.quantity;
            totalTax += lineGstAmount;

            return {
                ...item,
                gstSnapshot: {
                    rate,
                    amount: roundToTwo(lineGstAmount),
                    hsnCode,
                    ruleType,
                    basePrice: calc.basePrice,
                    taxIncluded
                }
            };
        })
    );

    return {
        items: enrichedItems,
        subtotal: roundToTwo(totalSubtotal),
        tax: roundToTwo(totalTax)
    };
};
