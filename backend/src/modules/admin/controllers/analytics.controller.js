import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import Order from '../../../models/Order.model.js';
import User from '../../../models/User.model.js';
import Vendor from '../../../models/Vendor.model.js';
import Product from '../../../models/Product.model.js';
import { DASHBOARD_RANGES, bucketExpr, percentChange, resolveRange } from '../../../services/analyticsRange.service.js';

// Dashboard period filter: ?range=today|yesterday|week|month|year limits a query to that period (IST).
// Without `range` the endpoints behave as before (all time / last 12 buckets), for the other pages using them.
const rangeFrom = (query) => (DASHBOARD_RANGES.includes(query.range) ? resolveRange(query.range) : null);
const inRange = (r, field = 'createdAt') => (r ? { [field]: { $gte: r.start, $lte: r.end } } : {});

// Totals for one period: revenue (excluding cancelled orders), order count and new customers.
const periodTotals = async (start, end) => {
    const createdAt = { $gte: start, $lte: end };
    const [orderAgg, newCustomers] = await Promise.all([
        Order.aggregate([
            { $match: { isDeleted: { $ne: true }, createdAt } },
            {
                $group: {
                    _id: null,
                    orders: { $sum: 1 },
                    revenue: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 0, '$total'] } },
                },
            },
        ]),
        User.countDocuments({ role: 'customer', createdAt }),
    ]);
    return { revenue: orderAgg[0]?.revenue || 0, orders: orderAgg[0]?.orders || 0, newCustomers };
};

// GET /api/admin/analytics/dashboard
export const getDashboardStats = asyncHandler(async (req, res) => {
    const r = rangeFrom(req.query);
    if (r) {
        const [current, previous, totalProducts, totalUsers, pendingOrders] = await Promise.all([
            periodTotals(r.start, r.end),
            periodTotals(r.prevStart, r.prevEnd),
            Product.countDocuments({ isActive: true }),
            User.countDocuments({ role: 'customer' }),
            Order.countDocuments({ isDeleted: { $ne: true }, status: 'pending' }),
        ]);
        return res.status(200).json(new ApiResponse(200, {
            range: r.range,
            start: r.start,
            end: r.end,
            totalRevenue: current.revenue,
            totalOrders: current.orders,
            newCustomers: current.newCustomers,
            totalUsers,
            totalProducts,
            pendingOrders,
            previous,
            revenueChange: percentChange(current.revenue, previous.revenue),
            ordersChange: percentChange(current.orders, previous.orders),
            customersChange: percentChange(current.newCustomers, previous.newCustomers),
        }, 'Dashboard stats fetched.'));
    }

    const activeOrderFilter = { isDeleted: { $ne: true } };
    const [totalOrders, totalUsers, totalVendors, totalProducts, revenueAgg, pendingOrders] = await Promise.all([
        Order.countDocuments(activeOrderFilter),
        User.countDocuments({ role: 'customer' }),
        Vendor.countDocuments({ status: 'approved' }),
        Product.countDocuments({ isActive: true }),
        Order.aggregate([{ $match: { ...activeOrderFilter, status: { $ne: 'cancelled' } } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
        Order.countDocuments({ ...activeOrderFilter, status: 'pending' }),
    ]);

    res.status(200).json(new ApiResponse(200, {
        totalOrders,
        totalUsers,
        totalVendors,
        totalProducts,
        totalRevenue: revenueAgg[0]?.total || 0,
        pendingOrders,
    }, 'Dashboard stats fetched.'));
});

// GET /api/admin/analytics/revenue
export const getRevenueData = asyncHandler(async (req, res) => {
    const r = rangeFrom(req.query);
    if (r) {
        // One point per hour / day / month of the period, zero-filled so the chart has no gaps.
        const rows = await Order.aggregate([
            { $match: { isDeleted: { $ne: true }, status: { $ne: 'cancelled' }, ...inRange(r) } },
            { $group: { _id: bucketExpr(r.format), revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
        ]);
        const byKey = new Map(rows.map((row) => [row._id, row]));
        const series = r.buckets.map(({ key, label }) => ({
            key,
            label,
            revenue: byKey.get(key)?.revenue || 0,
            orders: byKey.get(key)?.orders || 0,
        }));
        return res.status(200).json(new ApiResponse(200, series, 'Revenue data fetched.'));
    }

    const { period = 'monthly', startDate, endDate } = req.query;
    const groupFormat = period === 'daily' ? '%Y-%m-%d' : period === 'weekly' ? '%Y-%U' : '%Y-%m';
    const match = { isDeleted: { $ne: true }, status: { $ne: 'cancelled' } };
    if (startDate || endDate) {
        match.createdAt = {};
        if (startDate) match.createdAt.$gte = new Date(startDate);
        if (endDate) match.createdAt.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    }

    const pipeline = [
        { $match: match },
        { $group: { _id: { $dateToString: { format: groupFormat, date: '$createdAt' } }, revenue: { $sum: '$total' }, orders: { $sum: 1 } } },
    ];
    if (!startDate && !endDate) {
        pipeline.push({ $sort: { _id: -1 } }, { $limit: 12 });
    }
    pipeline.push({ $sort: { _id: 1 } });

    const revenue = await Order.aggregate(pipeline);

    res.status(200).json(new ApiResponse(200, revenue, 'Revenue data fetched.'));
});

// GET /api/admin/analytics/order-status
export const getOrderStatusBreakdown = asyncHandler(async (req, res) => {
    const breakdown = await Order.aggregate([
        { $match: { isDeleted: { $ne: true }, ...inRange(rangeFrom(req.query)) } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
    ]);

    const result = breakdown.map(item => ({ status: item._id, count: item.count }));
    res.status(200).json(new ApiResponse(200, result, 'Order status breakdown fetched.'));
});

// GET /api/admin/analytics/top-products
export const getTopProducts = asyncHandler(async (req, res) => {
    const topProducts = await Order.aggregate([
        { $match: { isDeleted: { $ne: true }, status: { $ne: 'cancelled' }, ...inRange(rangeFrom(req.query)) } },
        { $unwind: '$items' },
        { $group: { _id: '$items.productId', totalSold: { $sum: '$items.quantity' }, revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } } } },
        { $sort: { totalSold: -1 } },
        { $limit: 5 },
        { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
        { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
        {
            $project: {
                name: { $ifNull: ['$product.name', 'Unknown Product'] },
                image: {
                    $ifNull: [{ $arrayElemAt: ['$product.images', 0] }, '$product.image']
                },
                totalSold: 1,
                revenue: 1
            }
        },
    ]);

    res.status(200).json(new ApiResponse(200, topProducts, 'Top products fetched.'));
});

// GET /api/admin/analytics/customer-growth
export const getCustomerGrowth = asyncHandler(async (req, res) => {
    const r = rangeFrom(req.query);
    if (r) {
        const rows = await User.aggregate([
            { $match: { role: 'customer', ...inRange(r) } },
            { $group: { _id: bucketExpr(r.format), newUsers: { $sum: 1 } } },
        ]);
        const byKey = new Map(rows.map((row) => [row._id, row.newUsers]));
        const series = r.buckets.map(({ key, label }) => ({ _id: key, label, newUsers: byKey.get(key) || 0 }));
        return res.status(200).json(new ApiResponse(200, series, 'Customer growth fetched.'));
    }

    const { period = 'monthly' } = req.query;
    const groupFormat = period === 'daily' ? '%Y-%m-%d' : period === 'weekly' ? '%Y-%U' : '%Y-%m';

    const growth = await User.aggregate([
        { $match: { role: 'customer' } },
        { $group: { _id: { $dateToString: { format: groupFormat, date: '$createdAt' } }, newUsers: { $sum: 1 } } },
        { $sort: { _id: -1 } },
        { $limit: 12 },
        { $sort: { _id: 1 } },
    ]);

    res.status(200).json(new ApiResponse(200, growth, 'Customer growth fetched.'));
});

// GET /api/admin/analytics/recent-orders
export const getRecentOrders = asyncHandler(async (req, res) => {
    const orders = await Order.find({ isDeleted: { $ne: true }, ...inRange(rangeFrom(req.query)) })
        .populate('userId', 'name email')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();

    res.status(200).json(new ApiResponse(200, orders, 'Recent orders fetched.'));
});

// GET /api/admin/analytics/sales
export const getSalesData = asyncHandler(async (req, res) => {
    const { period = 'monthly', startDate, endDate } = req.query;
    const groupFormat = period === 'daily' ? '%Y-%m-%d' : period === 'weekly' ? '%Y-%U' : '%Y-%m';
    const match = { isDeleted: { $ne: true }, status: { $ne: 'cancelled' } };
    if (startDate || endDate) {
        match.createdAt = {};
        if (startDate) match.createdAt.$gte = new Date(startDate);
        if (endDate) match.createdAt.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    }

    const pipeline = [
        { $match: match },
        { $group: { _id: { $dateToString: { format: groupFormat, date: '$createdAt' } }, sales: { $sum: '$total' }, orders: { $sum: 1 } } },
    ];
    if (!startDate && !endDate) {
        pipeline.push({ $sort: { _id: -1 } }, { $limit: 12 });
    }
    pipeline.push({ $sort: { _id: 1 } });

    const sales = await Order.aggregate(pipeline);

    res.status(200).json(new ApiResponse(200, sales, 'Sales data fetched.'));
});

// GET /api/admin/analytics/finance-summary
export const getFinancialSummary = asyncHandler(async (req, res) => {
    const { period = 'monthly', startDate, endDate } = req.query;
    const groupFormat = period === 'daily' ? '%Y-%m-%d' : period === 'weekly' ? '%Y-%U' : '%Y-%m';
    const match = { isDeleted: { $ne: true }, status: { $ne: 'cancelled' } };
    if (startDate || endDate) {
        match.createdAt = {};
        if (startDate) match.createdAt.$gte = new Date(startDate);
        if (endDate) match.createdAt.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
    }

    const pipeline = [
        { $match: match },
        {
            $group: {
                _id: { $dateToString: { format: groupFormat, date: '$createdAt' } },
                revenue: { $sum: '$total' },
                subtotal: { $sum: '$subtotal' },
                tax: { $sum: '$tax' },
                delivery: { $sum: '$shipping' },
                discount: { $sum: '$discount' },
                orders: { $sum: 1 }
            }
        },
    ];
    if (!startDate && !endDate) {
        pipeline.push({ $sort: { _id: -1 } }, { $limit: 12 });
    }
    pipeline.push({ $sort: { _id: 1 } });

    const summary = await Order.aggregate(pipeline);

    res.status(200).json(new ApiResponse(200, summary, 'Financial summary fetched.'));
});

// GET /api/admin/analytics/inventory-stats
export const getInventoryStats = asyncHandler(async (req, res) => {
    const [totalProducts, outOfStock, lowStock] = await Promise.all([
        Product.countDocuments(),
        Product.countDocuments({ stock: 'out_of_stock' }),
        Product.countDocuments({ stock: 'low_stock' })
    ]);

    res.status(200).json(new ApiResponse(200, {
        totalProducts,
        outOfStock,
        lowStock,
        activeProducts: await Product.countDocuments({ isActive: true })
    }, 'Inventory stats fetched.'));
});
