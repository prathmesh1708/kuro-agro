import { useState, useMemo, useEffect } from 'react';
import { FiDownload, FiCalendar, FiPercent } from 'react-icons/fi';
import { motion } from 'framer-motion';
import DataTable from '../../../Admin/components/DataTable';
import ExportButton from '../../../Admin/components/ExportButton';
import AnimatedSelect from '../../../Admin/components/AnimatedSelect';
import { formatPrice } from '../../../../shared/utils/helpers';
import { useVendorAuthStore } from '../../store/vendorAuthStore';
import { getVendorOrders } from '../../services/vendorService';

const GstReport = () => {
  const { vendor } = useVendorAuthStore();
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [periodFilter, setPeriodFilter] = useState('all');
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const vendorId = vendor?.id;

  useEffect(() => {
    if (!vendorId) {
      setOrders([]);
      return;
    }

    const fetchOrders = async () => {
      setIsLoading(true);
      try {
        const res = await getVendorOrders({ limit: 500 });
        const data = res?.data ?? res;
        setOrders(data?.orders ?? []);
      } catch (err) {
        console.error("Failed to fetch seller orders for GST report:", err);
        setOrders([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
  }, [vendorId]);

  const filteredOrders = useMemo(() => {
    let filtered = orders;

    if (periodFilter !== 'all') {
      const now = new Date();
      const filterDate = new Date();

      switch (periodFilter) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          filtered = filtered.filter((order) => new Date(order.createdAt ?? order.date) >= filterDate);
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          filtered = filtered.filter((order) => new Date(order.createdAt ?? order.date) >= filterDate);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          filtered = filtered.filter((order) => new Date(order.createdAt ?? order.date) >= filterDate);
          break;
        case 'year':
          filterDate.setFullYear(now.getFullYear() - 1);
          filtered = filtered.filter((order) => new Date(order.createdAt ?? order.date) >= filterDate);
          break;
        default:
          break;
      }
    }

    if (dateRange.start || dateRange.end) {
      filtered = filtered.filter((order) => {
        const orderDate = new Date(order.createdAt ?? order.date);
        const start = dateRange.start ? new Date(dateRange.start) : null;
        const end = dateRange.end ? new Date(dateRange.end) : null;
        return (!start || orderDate >= start) && (!end || orderDate <= end);
      });
    }

    return filtered;
  }, [orders, dateRange, periodFilter]);

  // Extract GST details specific to the vendor from filtered orders
  const gstDetails = useMemo(() => {
    let totalSales = 0;
    let totalTax = 0;
    const itemsList = [];

    filteredOrders.forEach((order) => {
      const vendorGroup = order.vendorItems?.find(
        (vi) => vi.vendorId?.toString() === vendorId?.toString()
      );
      if (!vendorGroup) return;

      const groupSubtotal = vendorGroup.subtotal || 0;
      const groupTax = vendorGroup.tax || 0;

      totalSales += groupSubtotal;
      totalTax += groupTax;

      // Extract details for table
      vendorGroup.items?.forEach((item) => {
        const gstRate = item.gstSnapshot?.rate !== undefined ? item.gstSnapshot.rate : 18;
        const gstAmt = item.gstSnapshot?.amount || 0;
        const itemTotal = (item.price || 0) * (item.quantity || 1);

        itemsList.push({
          orderId: order.orderId,
          date: new Date(order.createdAt).toLocaleDateString(),
          itemName: item.name,
          quantity: item.quantity,
          unitPrice: item.price,
          subtotal: itemTotal,
          gstRate: gstRate,
          gstAmount: gstAmt,
          cgst: parseFloat((gstAmt / 2).toFixed(2)),
          sgst: parseFloat((gstAmt / 2).toFixed(2)),
        });
      });
    });

    return {
      totalSales,
      totalTax,
      items: itemsList,
    };
  }, [filteredOrders, vendorId]);

  const columns = [
    { key: 'orderId', label: 'Order ID' },
    { key: 'date', label: 'Date' },
    { key: 'itemName', label: 'Product Name' },
    { key: 'quantity', label: 'Qty' },
    {
      key: 'unitPrice',
      label: 'Price',
      render: (val) => formatPrice(val),
    },
    {
      key: 'gstRate',
      label: 'GST %',
      render: (val) => `${val}%`,
    },
    {
      key: 'gstAmount',
      label: 'Total GST',
      render: (val) => formatPrice(val),
    },
    {
      key: 'cgst',
      label: 'CGST (50%)',
      render: (val) => formatPrice(val),
    },
    {
      key: 'sgst',
      label: 'SGST (50%)',
      render: (val) => formatPrice(val),
    },
    {
      key: 'subtotal',
      label: 'Total Amount',
      render: (val) => formatPrice(val),
    },
  ];

  const exportData = useMemo(() => {
    return gstDetails.items.map((item) => ({
      'Order ID': item.orderId,
      'Date': item.date,
      'Product Name': item.itemName,
      'Quantity': item.quantity,
      'Price': item.unitPrice,
      'GST %': item.gstRate,
      'Total GST': item.gstAmount,
      'CGST (50%)': item.cgst,
      'SGST (50%)': item.sgst,
      'Total Amount': item.subtotal,
    }));
  }, [gstDetails.items]);

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Loading GST transactions data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <span className="text-gray-400 text-xs font-bold uppercase tracking-wider block">Total Sales</span>
          <span className="text-2xl font-black text-gray-900 mt-2 block">{formatPrice(gstDetails.totalSales)}</span>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <span className="text-purple-600 text-xs font-bold uppercase tracking-wider block">Total GST Collected</span>
          <span className="text-2xl font-black text-purple-600 mt-2 block">{formatPrice(gstDetails.totalTax)}</span>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <span className="text-blue-600 text-xs font-bold uppercase tracking-wider block">CGST Collected</span>
          <span className="text-2xl font-black text-blue-600 mt-2 block">{formatPrice(gstDetails.totalTax / 2)}</span>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <span className="text-emerald-600 text-xs font-bold uppercase tracking-wider block">SGST Collected</span>
          <span className="text-2xl font-black text-emerald-600 mt-2 block">{formatPrice(gstDetails.totalTax / 2)}</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-gray-50 rounded-xl p-4 border border-gray-200">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="w-40">
            <AnimatedSelect
              value={periodFilter}
              onChange={setPeriodFilter}
              options={[
                { value: 'all', label: 'All Time' },
                { value: 'today', label: 'Today' },
                { value: 'week', label: 'Last 7 Days' },
                { value: 'month', label: 'Last 30 Days' },
                { value: 'year', label: 'Last Year' },
              ]}
            />
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600">
            <FiCalendar />
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="border border-gray-200 rounded-lg p-1 text-xs focus:outline-none"
            />
            <span>to</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="border border-gray-200 rounded-lg p-1 text-xs focus:outline-none"
            />
          </div>
        </div>

        <div className="w-full sm:w-auto flex justify-end">
          <ExportButton
            data={exportData}
            filename={`gst_report_${vendor?.storeName || 'vendor'}`}
            headers={[
              'Order ID',
              'Date',
              'Product Name',
              'Quantity',
              'Price',
              'GST %',
              'Total GST',
              'CGST (50%)',
              'SGST (50%)',
              'Total Amount',
            ]}
          />
        </div>
      </div>

      {/* Details Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <DataTable
          columns={columns}
          data={gstDetails.items}
          keyField="orderId"
        />
        {gstDetails.items.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            No GST transactions found in the selected period.
          </div>
        )}
      </div>
    </div>
  );
};

export default GstReport;
