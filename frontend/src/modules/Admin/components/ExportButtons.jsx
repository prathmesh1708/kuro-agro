import { useState } from 'react';
import { FiDownload } from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../../../shared/utils/api';

/**
 * "Excel" and "PDF" download buttons for an admin list. The file is built by the backend from the
 * same filters as the list on screen (all matching rows, not just the current page).
 * @param {string} endpoint  e.g. '/admin/surveyors/export'
 * @param {Object} params    current list filters (status, search, sanchalak, …)
 * @param {string} filename  base file name, e.g. 'surveyors'
 */
const ExportButtons = ({ endpoint, params = {}, filename }) => {
  const [busy, setBusy] = useState(null);

  const download = async (format) => {
    setBusy(format);
    try {
      const blob = await api.get(endpoint, { params: { ...params, format }, responseType: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not download the file. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const button = (format, label, tone) => (
    <button
      type="button"
      onClick={() => download(format)}
      disabled={Boolean(busy)}
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold border transition-colors disabled:opacity-50 ${tone}`}
    >
      <FiDownload />
      {busy === format ? 'Preparing…' : label}
    </button>
  );

  return (
    <div className="flex flex-wrap gap-2">
      {button('xlsx', 'Excel', 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100')}
      {button('pdf', 'PDF', 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100')}
    </div>
  );
};

export default ExportButtons;
