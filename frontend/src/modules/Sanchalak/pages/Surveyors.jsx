import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiChevronRight } from 'react-icons/fi';
import FieldPanelLayout from '../../../shared/components/FieldAuth/FieldPanelLayout';
import { useSanchalakAuthStore } from '../store/sanchalakStore';
import { getKendraSurveyors } from '../services/sanchalakService';

const STATUS_CLASS = {
  pending: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  approved: 'bg-green-50 text-green-700 border-green-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  suspended: 'bg-orange-50 text-orange-700 border-orange-200',
};

const SanchalakSurveyors = () => {
  const { account } = useSanchalakAuthStore();
  const [surveyors, setSurveyors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getKendraSurveyors()
      .then((response) => setSurveyors(response?.data?.surveyors || []))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <FieldPanelLayout role="sanchalak" title="Surveyors">
      <h1 className="text-xl font-bold text-gray-900">Surveyors</h1>
      <p className="text-sm text-gray-500 mb-4">
        Tap a surveyor to see their farmers. Surveyors register using your code <span className="font-mono font-semibold text-gray-800">{account?.sanchalakCode}</span>. Admin approves them.
      </p>
      {isLoading ? (
        <p className="text-center text-sm text-gray-500 py-10">Loading…</p>
      ) : surveyors.length === 0 ? (
        <p className="text-center text-sm text-gray-500 py-10">No surveyors yet. Share your Sanchalak code to get started.</p>
      ) : (
        <ul className="space-y-3">
          {surveyors.map((s) => (
            <li key={s._id}>
              <Link
                to={`/sanchalak/surveyors/${s._id}`}
                className="flex items-center gap-3 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:border-gray-300 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-gray-900 truncate">{s.name}</p>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border capitalize ${STATUS_CLASS[s.status] || ''}`}>{s.status}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    <span className="font-mono">{s.surveyorCode}</span> · {s.phone} · {s.address?.village}, {s.address?.district}
                  </p>
                </div>
                <FiChevronRight className="text-gray-400 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </FieldPanelLayout>
  );
};

export default SanchalakSurveyors;
