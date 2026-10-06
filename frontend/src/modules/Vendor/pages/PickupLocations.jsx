import { useState, useEffect } from "react";
import {
  FiMapPin,
  FiPlus,
  FiEdit,
  FiTrash2,
  FiSearch,
  FiCheckCircle,
  FiX,
  FiTruck,
  FiAlertCircle,
  FiRefreshCw,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import DataTable from "../../Admin/components/DataTable";
import ConfirmModal from "../../Admin/components/ConfirmModal";
import { useVendorAuthStore } from "../store/vendorAuthStore";
import {
  getVendorPickupLocations,
  createVendorPickupLocation,
  updateVendorPickupLocation,
  deleteVendorPickupLocation,
  setDefaultVendorPickupLocation,
} from "../services/vendorService";
import { INDIAN_STATES } from "../../../shared/constants/indianStates";
import toast from "react-hot-toast";

const PickupLocations = () => {
  const { vendor } = useVendorAuthStore();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [locationModal, setLocationModal] = useState({
    isOpen: false,
    location: null,
  });
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    locationId: null,
  });

  const vendorId = vendor?.id;

  const fetchLocations = async () => {
    if (!vendorId) return;
    setLoading(true);
    try {
      const res = await getVendorPickupLocations();
      const rows = res?.data ?? res;
      setLocations(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error("Failed to load pickup locations:", err);
      toast.error("Failed to load pickup locations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, [vendorId]);

  const filteredLocations = locations.filter((loc) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (loc.name && loc.name.toLowerCase().includes(q)) ||
      (loc.address && loc.address.toLowerCase().includes(q)) ||
      (loc.city && loc.city.toLowerCase().includes(q)) ||
      (loc.zipCode && loc.zipCode.toLowerCase().includes(q)) ||
      (loc.shiprocketLocationName && loc.shiprocketLocationName.toLowerCase().includes(q))
    );
  });

  const handleSave = async (locationData) => {
    try {
      if (locationModal.location?._id || locationModal.location?.id) {
        const id = locationModal.location._id || locationModal.location.id;
        await updateVendorPickupLocation(id, locationData);
        toast.success("Pickup warehouse updated & synced with Shiprocket!");
      } else {
        await createVendorPickupLocation(locationData);
        toast.success("Pickup warehouse created & synced with Shiprocket!");
      }
      setLocationModal({ isOpen: false, location: null });
      fetchLocations();
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || "Failed to save pickup location.");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteVendorPickupLocation(deleteModal.locationId);
      toast.success("Pickup location deleted.");
      setDeleteModal({ isOpen: false, locationId: null });
      fetchLocations();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to delete pickup location.");
    }
  };

  const handleSetDefault = async (locationId) => {
    try {
      await setDefaultVendorPickupLocation(locationId);
      toast.success("Default pickup warehouse updated.");
      fetchLocations();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to set default.");
    }
  };

  const columns = [
    {
      key: "name",
      label: "Warehouse Location",
      sortable: true,
      render: (value, row) => (
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-50 text-purple-700 rounded-lg">
            <FiMapPin className="text-base" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-800">{value}</span>
              {row.isDefault && (
                <span className="text-[11px] px-2 py-0.5 bg-emerald-100 text-emerald-800 font-semibold rounded-full">
                  Default Pickup
                </span>
              )}
            </div>
            {row.shiprocketLocationName && (
              <p className="text-xs text-purple-700 font-mono mt-0.5 flex items-center gap-1">
                <FiTruck className="text-[11px]" /> SR Nickname: {row.shiprocketLocationName}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "address",
      label: "Address & City",
      sortable: false,
      render: (value, row) => (
        <div className="text-xs text-gray-700 space-y-0.5">
          <p className="font-medium text-gray-800">{value || row.address?.street || "N/A"}</p>
          <p className="text-gray-500">
            {[row.city || row.address?.city, row.state || row.address?.state, row.zipCode || row.address?.zipCode]
              .filter(Boolean)
              .join(", ")}
          </p>
        </div>
      ),
    },
    {
      key: "phone",
      label: "Warehouse Contact",
      sortable: false,
      render: (value, row) => (
        <div className="text-xs space-y-0.5">
          <p className="font-medium text-gray-800">{value || "N/A"}</p>
          <p className="text-gray-500">{row.email || "N/A"}</p>
        </div>
      ),
    },
    {
      key: "syncStatus",
      label: "Shiprocket Sync",
      sortable: true,
      render: (value, row) => {
        if (row.isSyncedWithShiprocket || value === 'synced') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-full">
              <FiCheckCircle className="text-xs" /> Synced
            </span>
          );
        }
        if (value === 'failed') {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 text-xs font-semibold rounded-full" title={row.syncError}>
              <FiAlertCircle className="text-xs" /> Sync Error
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold rounded-full">
            <FiRefreshCw className="text-xs" /> Pending
          </span>
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-2">
          {!row.isDefault && (
            <button
              onClick={() => handleSetDefault(row._id || row.id)}
              className="px-2.5 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-50 rounded-lg transition-colors border border-purple-200"
              title="Set as default pickup location"
            >
              Make Default
            </button>
          )}
          <button
            onClick={() => setLocationModal({ isOpen: true, location: row })}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit location"
          >
            <FiEdit />
          </button>
          <button
            onClick={() => setDeleteModal({ isOpen: true, locationId: row._id || row.id })}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete location"
          >
            <FiTrash2 />
          </button>
        </div>
      ),
    },
  ];

  if (!vendorId) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">
          Please log in to manage pickup locations
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="lg:hidden">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
            Pickup Locations
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            Manage your store pickup locations
          </p>
        </div>
        <button
          onClick={() => setLocationModal({ isOpen: true, location: null })}
          className="flex items-center gap-2 px-4 py-2 gradient-green text-white rounded-lg hover:shadow-glow-green transition-all font-semibold">
          <FiPlus />
          <span>Add Location</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search locations..."
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Locations Table */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        {filteredLocations.length > 0 ? (
          <DataTable
            data={filteredLocations}
            columns={columns}
            pagination={true}
            itemsPerPage={10}
          />
        ) : (
          <div className="text-center py-12">
            <FiMapPin className="mx-auto text-4xl text-gray-400 mb-4" />
            <p className="text-gray-500 mb-4">No pickup locations found</p>
            <button
              onClick={() => setLocationModal({ isOpen: true, location: null })}
              className="px-4 py-2 gradient-green text-white rounded-lg hover:shadow-glow-green transition-all font-semibold">
              Add Your First Location
            </button>
          </div>
        )}
      </div>

      {/* Location Modal */}
      <LocationModal
        isOpen={locationModal.isOpen}
        location={locationModal.location}
        onClose={() => setLocationModal({ isOpen: false, location: null })}
        onSave={handleSave}
      />

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, locationId: null })}
        onConfirm={handleDelete}
        title="Delete Location?"
        message="Are you sure you want to delete this pickup location? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </motion.div>
  );
};

// Location Modal Component
const LocationModal = ({ isOpen, location, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: "",
    building: "",
    street: "",
    city: "",
    state: "Madhya Pradesh",
    zipCode: "",
    country: "India",
    phone: "",
    email: "",
    isActive: true,
    isDefault: false,
  });

  useEffect(() => {
    if (location) {
      const rawAddress = location.address?.street || (typeof location.address === 'string' ? location.address : "") || "";
      let buildingPart = "";
      let streetPart = rawAddress;
      if (rawAddress.includes(',')) {
        const parts = rawAddress.split(',');
        buildingPart = parts[0]?.trim() || "";
        streetPart = parts.slice(1).join(',').trim() || buildingPart;
      }

      setFormData({
        name: location.name || "",
        building: buildingPart,
        street: streetPart || rawAddress,
        city: location.city || location.address?.city || "",
        state: location.state || location.address?.state || "Madhya Pradesh",
        zipCode: location.zipCode || location.address?.zipCode || "",
        country: "India",
        phone: location.phone || "",
        email: location.email || "",
        isActive: location.isActive !== false,
        isDefault: Boolean(location.isDefault),
        operatingHours: location.operatingHours,
      });
    } else {
      setFormData({
        name: "",
        building: "",
        street: "",
        city: "",
        state: "Madhya Pradesh",
        zipCode: "",
        country: "India",
        phone: "",
        email: "",
        isActive: true,
        isDefault: false,
      });
    }
  }, [location, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || (!formData.building && !formData.street) || !formData.city || !formData.zipCode) {
      toast.error("Please fill in Location Name, Address, City, and 6-digit Pincode.");
      return;
    }

    const combinedAddress = formData.building
      ? `${formData.building.trim()}, ${formData.street.trim()}`
      : formData.street.trim();

    onSave({
      ...formData,
      address: combinedAddress,
      city: formData.city.trim(),
      state: formData.state?.trim() || 'Madhya Pradesh',
      zipCode: formData.zipCode.trim(),
      phone: (formData.phone || '').trim(),
      email: (formData.email || '').trim(),
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">
                      {location ? "Edit Pickup Warehouse" : "Add Pickup Warehouse"}
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">Couriers will pickup orders from this address.</p>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <FiX className="text-gray-500" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">
                    Location / Warehouse Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    placeholder="e.g. Main Warehouse, Palasia Store"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Shop / Building / Flat No. & Floor <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="building"
                      value={formData.building}
                      onChange={handleChange}
                      required
                      placeholder="e.g. Shop 14, Ground Floor"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Road / Street / Area / Landmark <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="street"
                      value={formData.street}
                      onChange={handleChange}
                      required
                      placeholder="e.g. Palasia Main Road, Near Square"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      City <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      required
                      placeholder="e.g. Indore"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      State <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="state"
                      value={formData.state || 'Madhya Pradesh'}
                      onChange={handleChange}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-medium bg-white">
                      {INDIAN_STATES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Pincode (6 digits) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="zipCode"
                      maxLength={6}
                      value={formData.zipCode}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                        setFormData((prev) => ({ ...prev, zipCode: val }));
                      }}
                      required
                      placeholder="e.g. 452001"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Country
                    </label>
                    <input
                      type="text"
                      name="country"
                      value="India"
                      disabled
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-600 text-sm cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Contact Phone (10 digits)
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      maxLength={10}
                      value={formData.phone}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setFormData((prev) => ({ ...prev, phone: val }));
                      }}
                      placeholder="e.g. 9876543210"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">
                      Contact Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="warehouse@example.com"
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) =>
                        setFormData({ ...formData, isActive: e.target.checked })
                      }
                      className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">
                      Active Location
                    </span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.isDefault}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          isDefault: e.target.checked,
                        })
                      }
                      className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">
                      Set as Default
                    </span>
                  </label>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-semibold">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 gradient-green text-white rounded-lg hover:shadow-glow-green transition-all font-semibold">
                    {location ? "Update Location" : "Add Location"}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default PickupLocations;
