import { useState } from 'react';
import { FiChevronDown } from 'react-icons/fi';
import { commissionLabel } from './seedFormat';

// The Sanchalak's earning model: what they earn per unit on each product, and what it is paid on.
// Stacked cards rather than a table — the field panels are phone-width and a rate / basis pair
// does not fit in columns there.
const CommissionRateCard = ({ rows = [], defaultOpen = true }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  if (rows.length === 0) return null;

  return (
    <section className="mt-5">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="w-full flex items-center justify-between gap-2 mb-3"
      >
        <h2 className="text-base font-bold text-gray-900">Earning Model / कमीशन दर</h2>
        <FiChevronDown className={`shrink-0 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{row.name}</p>
                    {row.nameHi && <p className="text-xs text-gray-500">{row.nameHi}</p>}
                  </div>
                  <p className="shrink-0 text-sm font-bold text-sky-700 text-right">{commissionLabel(row)}</p>
                </div>
                {row.basis && (
                  <p className="mt-2 pt-2 border-t border-gray-100 text-[11px] text-gray-500">
                    {row.basis}
                    {row.basisHi && <span className="block">{row.basisHi}</span>}
                  </p>
                )}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-gray-400 mt-3">
            A rate shown as a range is agreed per consignment, within that band. The rate is fixed when the
            seed is dispatched, so a later change never affects what you have already earned.
          </p>
        </>
      )}
    </section>
  );
};

export default CommissionRateCard;
