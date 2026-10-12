import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { FiPlus, FiEdit, FiTrash2, FiUpload, FiVideo } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import DataTable from "../../components/DataTable";
import ConfirmModal from "../../components/ConfirmModal";
import AnimatedSelect from "../../components/AnimatedSelect";
import { useBannerStore } from "../../../../shared/store/bannerStore";
import toast from "react-hot-toast";
import { uploadAdminImage, uploadAdminVideo } from "../../services/adminService";

const HomeSliders = () => {
  const location = useLocation();
  const isAppRoute = location.pathname.startsWith("/app");
  const { banners, initialize, createBanner, updateBanner, deleteBanner } =
    useBannerStore();
  const [selectedBannerType, setSelectedBannerType] = useState("home_slider");

  const sliders = useMemo(
    () =>
      (banners || [])
        .filter((banner) => banner.type === selectedBannerType)
        .map((banner) => ({
          ...banner,
          id: banner._id,
          status: banner.isActive ? "active" : "inactive",
        }))
        .sort((a, b) => (a.order || 0) - (b.order || 0)),
    [banners, selectedBannerType]
  );

  const [editingSlider, setEditingSlider] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null });
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);

  useEffect(() => {
    initialize();
  }, [initialize]);

  const handleSave = async (sliderData) => {
    const payload = {
      title: sliderData.title,
      image: sliderData.image,
      video: sliderData.video,
      mediaType: sliderData.mediaType || (sliderData.video ? "video" : "image"),
      link: sliderData.link,
      order: sliderData.order,
      isActive: sliderData.status === "active",
      type: sliderData.type || selectedBannerType,
    };

    try {
      if (editingSlider && editingSlider.id) {
        await updateBanner(editingSlider.id, payload);
      } else {
        await createBanner(payload);
      }
      await initialize();
      setEditingSlider(null);
    } catch (error) {
      // Error handled in store
    }
  };

  const handleDelete = async () => {
    try {
      await deleteBanner(deleteModal.id);
      await initialize();
    } catch (error) {
      // Error handled in store
    } finally {
      setDeleteModal({ isOpen: false, id: null });
    }
  };

  const handleSliderImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !editingSlider) return;

    if (!file.type?.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }

    setIsUploadingImage(true);
    try {
      const response = await uploadAdminImage(file, "banners");
      const imageUrl = response?.data?.url;
      if (!imageUrl) {
        toast.error("Image upload failed");
        return;
      }
      setEditingSlider((prev) => ({ ...prev, image: imageUrl }));
      toast.success("Image uploaded successfully");
    } catch (error) {
      // Error toast handled by api interceptor
    } finally {
      setIsUploadingImage(false);
      e.target.value = "";
    }
  };

  const handleSliderVideoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !editingSlider) return;

    if (!file.type?.startsWith("video/")) {
      toast.error("Please select a valid video file (MP4, WebM, MOV)");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error("Video size cannot exceed 50MB");
      return;
    }

    setIsUploadingVideo(true);
    try {
      const response = await uploadAdminVideo(file, "banners/videos");
      const videoUrl = response?.data?.url;
      if (!videoUrl) {
        toast.error("Video upload failed");
        return;
      }
      setEditingSlider((prev) => ({ ...prev, video: videoUrl, mediaType: "video" }));
      toast.success("Video uploaded successfully");
    } catch (error) {
      // Error toast handled by api interceptor
    } finally {
      setIsUploadingVideo(false);
      e.target.value = "";
    }
  };

  const columns = [
    {
      key: "image",
      label: "Media",
      sortable: false,
      render: (value, row) => (
        <div className="flex items-center gap-3">
          {row.mediaType === "video" || row.video ? (
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-black flex items-center justify-center relative">
              <video src={row.video || value} className="w-full h-full object-cover" muted playsInline />
              <FiVideo className="absolute text-white text-xs bg-black/60 p-0.5 rounded bottom-1 right-1" />
            </div>
          ) : (
            <img
              src={value}
              alt={row.title}
              className="w-16 h-16 object-cover rounded-lg"
              onError={(e) => {
                e.target.src = "https://via.placeholder.com/64x64?text=Image";
              }}
            />
          )}
          <span className="font-medium text-gray-800">{row.title}</span>
        </div>
      ),
    },
    {
      key: "link",
      label: "Link",
      sortable: false,
      render: (value) => <span className="text-sm text-gray-600">{value}</span>,
    },
    {
      key: "order",
      label: "Order",
      sortable: true,
    },
    {
      key: "status",
      label: "Status",
      sortable: true,
      render: (value) => (
        <span
          className={`px-2 py-1 rounded text-xs font-medium ${
            value === "active"
              ? "bg-green-100 text-green-800"
              : "bg-gray-100 text-gray-800"
          }`}>
          {value}
        </span>
      ),
    },
    {
      key: "type",
      label: "Type",
      sortable: false,
      render: (value) => (
        <span className="text-sm text-gray-700">
          {value === "side_banner" ? "Side Banner" : "Home Slider"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditingSlider(row)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
            <FiEdit />
          </button>
          <button
            onClick={() => setDeleteModal({ isOpen: true, id: row.id })}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <FiTrash2 />
          </button>
        </div>
      ),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="lg:hidden">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
            Home Sliders
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            Manage homepage slider and right-side banners
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AnimatedSelect
            value={selectedBannerType}
            onChange={(e) => setSelectedBannerType(e.target.value)}
            options={[
              { value: "home_slider", label: "Home Sliders" },
              { value: "side_banner", label: "Side Banners" },
            ]}
            className="min-w-[170px]"
          />
          <button
            onClick={() =>
              setEditingSlider({
                title: "",
                image: "",
                link: "",
                order: 1,
                status: "active",
                type: selectedBannerType,
              })
            }
            className="flex items-center gap-2 px-4 py-2 gradient-green text-white rounded-lg hover:shadow-glow-green transition-all font-semibold text-sm">
            <FiPlus />
            <span>
              {selectedBannerType === "side_banner"
                ? "Add Side Banner"
                : "Add Slider"}
            </span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <DataTable data={sliders} columns={columns} pagination={true} itemsPerPage={10} />
      </div>

      <AnimatePresence>
        {editingSlider !== null && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={() => setEditingSlider(null)}
              className="fixed inset-0 bg-black/50 z-[10000]"
            />

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`fixed inset-0 z-[10000] flex ${
                isAppRoute ? "items-start pt-[10px]" : "items-end"
              } sm:items-center justify-center p-4 pointer-events-none`}>
              <motion.div
                variants={{
                  hidden: {
                    y: isAppRoute ? "-100%" : "100%",
                    scale: 0.95,
                    opacity: 0,
                  },
                  visible: {
                    y: 0,
                    scale: 1,
                    opacity: 1,
                    transition: {
                      type: "spring",
                      damping: 22,
                      stiffness: 350,
                      mass: 0.7,
                    },
                  },
                  exit: {
                    y: isAppRoute ? "-100%" : "100%",
                    scale: 0.95,
                    opacity: 0,
                    transition: {
                      type: "spring",
                      damping: 30,
                      stiffness: 400,
                    },
                  },
                }}
                initial="hidden"
                animate="visible"
                exit="exit"
                onClick={(e) => e.stopPropagation()}
                className={`bg-white ${
                  isAppRoute ? "rounded-b-3xl" : "rounded-t-3xl"
                } sm:rounded-xl shadow-xl p-6 max-w-md w-full pointer-events-auto`}
                style={{ willChange: "transform" }}>
                <h3 className="text-lg font-bold text-gray-800 mb-4">
                  {editingSlider.id
                    ? editingSlider.type === "side_banner"
                      ? "Edit Side Banner"
                      : "Edit Slider"
                    : selectedBannerType === "side_banner"
                    ? "Add Side Banner"
                    : "Add Slider"}
                </h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target);
                    handleSave({
                      type: formData.get("type"),
                      title: formData.get("title"),
                      image: formData.get("image"),
                      video: formData.get("video"),
                      mediaType: formData.get("video") ? "video" : "image",
                      link: formData.get("link"),
                      order: parseInt(formData.get("order"), 10) || 1,
                      status: formData.get("status"),
                    });
                  }}
                  className="space-y-4">
                  <AnimatedSelect
                    name="type"
                    value={editingSlider.type || selectedBannerType}
                    onChange={(e) =>
                      setEditingSlider({
                        ...editingSlider,
                        type: e.target.value,
                      })
                    }
                    options={[
                      { value: "home_slider", label: "Home Slider" },
                      { value: "side_banner", label: "Side Banner (Home Right)" },
                    ]}
                    required
                  />
                  <input
                    type="text"
                    name="title"
                    defaultValue={editingSlider.title || ""}
                    placeholder="Title"
                    required
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Image URL</label>
                    <input
                      type="text"
                      name="image"
                      value={editingSlider.image || ""}
                      onChange={(e) =>
                        setEditingSlider({
                          ...editingSlider,
                          image: e.target.value,
                        })
                      }
                      placeholder="Image URL"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    />
                    <label className={`mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg transition-colors text-xs font-semibold ${isUploadingImage ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-gray-200"}`}>
                      <FiUpload />
                      {isUploadingImage ? "Uploading Image..." : "Upload Image to Cloudinary"}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleSliderImageUpload}
                        className="hidden"
                        disabled={isUploadingImage}
                      />
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Video URL (Optional)</label>
                    <input
                      type="text"
                      name="video"
                      value={editingSlider.video || ""}
                      onChange={(e) =>
                        setEditingSlider({
                          ...editingSlider,
                          video: e.target.value,
                          mediaType: e.target.value ? "video" : "image",
                        })
                      }
                      placeholder="Video URL (e.g. Cloudinary mp4 URL)"
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    />
                    <label className={`mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg transition-colors text-xs font-semibold ${isUploadingVideo ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-blue-100"}`}>
                      <FiVideo />
                      {isUploadingVideo ? "Uploading Video..." : "Upload Video to Cloudinary"}
                      <input
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime"
                        onChange={handleSliderVideoUpload}
                        className="hidden"
                        disabled={isUploadingVideo}
                      />
                    </label>
                  </div>
                  <input
                    type="text"
                    name="link"
                    defaultValue={editingSlider.link || ""}
                    placeholder="Optional: /offers or https://example.com"
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <p className="text-xs text-gray-500 -mt-2">
                    Leave empty to make banner non-clickable. Invalid links are ignored.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <input
                      type="number"
                      name="order"
                      defaultValue={editingSlider.order || 1}
                      placeholder="Order"
                      required
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <AnimatedSelect
                      name="status"
                      value={editingSlider.status || "active"}
                      onChange={(e) =>
                        setEditingSlider({
                          ...editingSlider,
                          status: e.target.value,
                        })
                      }
                      options={[
                        { value: "active", label: "Active" },
                        { value: "inactive", label: "Inactive" },
                      ]}
                      required
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-semibold">
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingSlider(null)}
                      className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-semibold">
                      Cancel
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, id: null })}
        onConfirm={handleDelete}
        title="Delete Slider?"
        message="Are you sure you want to delete this slider? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </motion.div>
  );
};

export default HomeSliders;
