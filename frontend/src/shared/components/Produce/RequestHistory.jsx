import { ACTOR_LABELS, HISTORY_LABELS, formatDateTime } from './produceFormat';

// Timeline of a request's status and payment changes, oldest first.
const RequestHistory = ({ history = [] }) => {
  if (!history.length) return null;
  return (
    <section className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <h2 className="text-base font-bold text-gray-900 mb-3">History</h2>
      <ol className="space-y-3">
        {history.map((entry, index) => (
          <li key={`${entry.action}-${entry.at}-${index}`} className="flex gap-3">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gray-400" />
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-gray-800">
                {HISTORY_LABELS[entry.action] || entry.action}
                <span className="font-normal text-gray-500"> · {ACTOR_LABELS[entry.byType] || entry.byType}</span>
              </p>
              {entry.note && <p className="text-gray-600 break-words">{entry.note}</p>}
              <p className="text-xs text-gray-400">{formatDateTime(entry.at)}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
};

export default RequestHistory;
