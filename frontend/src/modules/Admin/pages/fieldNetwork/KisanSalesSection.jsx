import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import TradeStatusBadge, { PaymentBadge } from '../../../../shared/components/Produce/TradeStatusBadge';
import { finalTerms, formatDate, formatInr, formatQty } from '../../../../shared/components/Produce/produceFormat';
import { getKisanSaleRequests, getKisans, updateKisanStatus } from '../../services/adminService';

// Shown in the farmer drawer once a registration is approved: the farmer's Kisan login and produce sales.
const KisanSalesSection = ({ registrationId }) => {
  const [kisan, setKisan] = useState(undefined);
  const [sales, setSales] = useState(null);
  const [reason, setReason] = useState('');
  const [suspendMode, setSuspendMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(() => {
    getKisans({ registration: registrationId, limit: 1 })
      .then((response) => setKisan(response?.data?.kisans?.[0] || null))
      .catch(() => setKisan(null));
    getKisanSaleRequests({ registration: registrationId, limit: 20 })
      .then((response) => setSales(response?.data || null))
      .catch(() => setSales(null));
  }, [registrationId]);

  useEffect(() => {
    load();
  }, [load]);

  const changeStatus = async (status) => {
    if (status === 'suspended' && !reason.trim()) {
      toast.error('Please enter a reason.');
      return;
    }
    setIsSaving(true);
    try {
      await updateKisanStatus(kisan.id, status, reason.trim());
      toast.success(status === 'suspended' ? 'Kisan suspended.' : 'Kisan reactivated.');
      setSuspendMode(false);
      setReason('');
      load();
    } catch {
      // The API client already shows the error message.
    } finally {
      setIsSaving(false);
    }
  };

  if (kisan === undefined) return null;

  return (
    <div className="space-y-4 mt-4">
      <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <h3 className="text-base font-bold text-gray-900 mb-2">Kisan Login</h3>
        {!kisan ? (
          <p className="text-sm text-gray-500">The farmer&apos;s login is created the first time they log in with their mobile number.</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 text-sm">
              <div>
                <p className="font-mono font-semibold text-gray-800">{kisan.kisanCode}</p>
                <p className="text-xs text-gray-500">Last login {formatDate(kisan.lastLoginAt)}</p>
              </div>
              <span className={`px-2.5 py-1 rounded-full border text-xs font-semibold ${kisan.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                {kisan.status === 'active' ? 'Active' : 'Suspended'}
              </span>
            </div>
            {kisan.status === 'suspended' && kisan.rejectionReason && <p className="text-xs text-gray-500 mt-2">{kisan.rejectionReason}</p>}
            {suspendMode && (
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Reason for suspending"
                className="mt-3 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
              />
            )}
            <div className="flex gap-2 mt-3">
              {kisan.status === 'active' ? (
                suspendMode ? (
                  <>
                    <button type="button" onClick={() => setSuspendMode(false)} className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700">Cancel</button>
                    <button type="button" disabled={isSaving} onClick={() => changeStatus('suspended')} className="flex-1 px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold disabled:opacity-50">Confirm Suspend</button>
                  </>
                ) : (
                  <button type="button" onClick={() => setSuspendMode(true)} className="px-3 py-2 rounded-lg bg-orange-50 text-orange-600 text-sm font-semibold hover:bg-orange-100">Suspend Login</button>
                )
              ) : (
                <button type="button" disabled={isSaving} onClick={() => changeStatus('active')} className="px-3 py-2 rounded-lg bg-green-50 text-green-600 text-sm font-semibold hover:bg-green-100 disabled:opacity-50">Reactivate</button>
              )}
            </div>
          </>
        )}
      </section>

      <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <h3 className="text-base font-bold text-gray-900 mb-2">Produce Sales to Kendra</h3>
        {!sales || sales.requests.length === 0 ? (
          <p className="text-sm text-gray-500">No produce offered yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {sales.requests.map((request) => {
              const terms = finalTerms(request);
              return (
                <li key={request.id} className="py-2.5 flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800">{request.produceName} · {formatQty(terms.quantityKg, request.unit)}</p>
                    <p className="text-xs text-gray-500">
                      <span className="font-mono">{request.requestCode}</span> · {formatDate(request.createdAt)} · {formatInr(terms.pricePerUnit)}/{request.unit}
                    </p>
                  </div>
                  <div className="text-right shrink-0 space-y-1">
                    <p className="font-semibold text-gray-900">{formatInr(terms.totalAmount)}</p>
                    <TradeStatusBadge status={request.status} />
                    {request.status === 'purchased' && <div><PaymentBadge payment={request.payment} /></div>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
};

export default KisanSalesSection;
