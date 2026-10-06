import { useState, useEffect } from "react";
import { FiSave, FiInfo } from "react-icons/fi";
import { useCategoryStore } from "../../../../shared/store/categoryStore";
import { getVendorGstSettings, updateVendorGstSettings } from "../../services/vendorService";
import toast from "react-hot-toast";

const GstSettings = () => {
  const { categories, initialize: initCategories } = useCategoryStore();
  const [rates, setRates] = useState({}); // mapping of categoryId -> rate
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    initCategories();
    loadGstSettings();
  }, [initCategories]);

  const loadGstSettings = async () => {
    setIsLoading(true);
    try {
      const res = await getVendorGstSettings();
      if (res?.data) {
        const rateMap = {};
        res.data.forEach((item) => {
          rateMap[item.categoryId?._id || item.categoryId] = item.rate;
        });
        setRates(rateMap);
      }
    } catch (err) {
      console.error("Failed to load seller GST settings", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRateChange = (categoryId, value) => {
    setRates({
      ...rates,
      [categoryId]: value,
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const settingsPayload = Object.entries(rates)
        .map(([categoryId, rateStr]) => {
          if (rateStr === "" || rateStr === null || rateStr === undefined) return null;
          const rate = parseFloat(rateStr);
          if (isNaN(rate) || rate < 0 || rate > 100) {
            throw new Error(`GST percentage must be between 0 and 100.`);
          }
          return { categoryId, rate };
        })
        .filter(Boolean);

      await updateVendorGstSettings({ settings: settingsPayload });
      toast.success("GST Settings saved successfully!");
      loadGstSettings();
    } catch (err) {
      toast.error(err.message || "Failed to save GST settings.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Loading category GST configurations...</p>
      </div>
    );
  }

  const activeCategories = categories.filter((cat) => cat.isActive !== false);

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-800">Default Category GST Rules</h3>
          <p className="text-sm text-gray-500 mt-1">
            Configure default GST rates for categories. These defaults will auto-fill when adding new products, but you can always override them on the product page.
          </p>
        </div>
        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg hover:shadow-glow-purple transition-all font-semibold text-sm disabled:opacity-50 shrink-0"
        >
          <FiSave />
          <span>{isSaving ? "Saving..." : "Save GST Settings"}</span>
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 flex gap-3 text-sm">
        <FiInfo className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Important Notes:</p>
          <ul className="list-disc pl-4 space-y-1 mt-1 text-xs">
            <li>Standard GST slabs: 0%, 3%, 5%, 12%, 18%, 28%.</li>
            <li>Custom decimal GST (e.g. 7.5%, 0.25%) is supported.</li>
            <li>Rates cannot be negative or exceed 100%.</li>
            <li>Configuring category defaults is entirely optional.</li>
          </ul>
        </div>
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-gray-500 text-xs font-bold uppercase">
              <th className="py-3 px-4">Category Name</th>
              <th className="py-3 px-4 w-40">Default GST Rate (%)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-sm">
            {activeCategories.map((category) => {
              const currentVal = rates[category._id ?? category.id] !== undefined ? rates[category._id ?? category.id] : "";
              return (
                <tr key={category._id ?? category.id} className="hover:bg-gray-50">
                  <td className="py-3.5 px-4 font-medium text-gray-800">
                    {category.name}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        max="100"
                        value={currentVal}
                        onChange={(e) => handleRateChange(category._id ?? category.id, e.target.value)}
                        placeholder="e.g. 18"
                        className="w-full px-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600 focus:border-transparent text-sm"
                      />
                      {currentVal !== "" && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-xs">
                          %
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {activeCategories.length === 0 && (
              <tr>
                <td colSpan={2} className="text-center py-8 text-gray-400">
                  No active categories found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end pt-4">
        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg hover:shadow-glow-purple transition-all font-semibold text-sm disabled:opacity-50"
        >
          <FiSave />
          <span>{isSaving ? "Saving..." : "Save GST Settings"}</span>
        </button>
      </div>
    </form>
  );
};

export default GstSettings;
