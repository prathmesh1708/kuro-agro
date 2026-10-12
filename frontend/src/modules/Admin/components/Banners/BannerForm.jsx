import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { FiX, FiSave, FiUpload, FiVideo, FiImage, FiTrash2 } from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { useBannerStore } from "../../../../shared/store/bannerStore";
import AnimatedSelect from "../AnimatedSelect";
import toast from "react-hot-toast";
import Button from "../Button";
import { uploadAdminImage, uploadAdminVideo } from "../../services/adminService";

const BannerForm = ({ banner, onClose, onSave }) => {
  const location = useLocation();
  const isAppRoute = location.pathname.startsWith("/app");
  const { createBanner, updateBanner } = useBannerStore();
  const isEdit = !!banner;
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);

  const [formData, setFormData] = useState({
    type: "hero",
    mediaType: "image",
    title: "",
    subtitle: "",
    description: "",
    image: "",
    video: "",
    link: "",
    order: 1,
    isActive: true,
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    if (banner) {
      const initialMediaType = banner.mediaType || (banner.video ? "video" : "image");
      setFormData({
        type: banner.type || "hero",
        mediaType: initialMediaType,
        title: banner.title || "",
        subtitle: banner.subtitle || "",
        description: banner.description || "",
        image: banner.image || "",
        video: banner.video || "",
        link: banner.link || "",
        order: banner.order || 1,
        isActive: banner.isActive !== undefined ? banner.isActive : true,
        startDate: banner.startDate ? banner.startDate.split("T")[0] : "",
        endDate: banner.endDate ? banner.endDate.split("T")[0] : "",
      });
    }
  }, [banner]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type?.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }

    setIsUploadingImage(true);
    try {
      const response = await uploadAdminImage(file, "banners");
      const url = response?.data?.url;
      if (!url) {
        toast.error("Image upload failed");
        return;
      }
      setFormData((prev) => ({ ...prev, image: url }));
      toast.success("Image uploaded successfully");
    } catch (error) {
      // Error toast handled by api interceptor
    } finally {
      setIsUploadingImage(false);
      e.target.value = "";
    }
  };

  const handleVideoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validVideoTypes = ["video/mp4", "video/webm", "video/quicktime"];
    if (!validVideoTypes.includes(file.type) && !file.type?.startsWith("video/")) {
      toast.error("Please select a valid video file (MP4, WebM, MOV)");
      return;
    }

    // 50MB max file size check
    if (file.size > 50 * 1024 * 1024) {
      toast.error("Video file size cannot exceed 50MB");
      return;
    }

    setIsUploadingVideo(true);
    try {
      const response = await uploadAdminVideo(file, "banners/videos");
      const url = response?.data?.url;
      if (!url) {
        toast.error("Video upload failed");
        return;
      }
      setFormData((prev) => ({
        ...prev,
        video: url,
        mediaType: "video",
      }));
      toast.success("Video uploaded successfully");
    } catch (error) {
      // Error toast handled by api interceptor
    } finally {
      setIsUploadingVideo(false);
      e.target.value = "";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.mediaType === "video") {
      if (!formData.video?.trim() && !formData.image?.trim()) {
        toast.error("Please upload or provide a video URL");
        return;
      }
    } else {
      if (!formData.image?.trim() && !formData.video?.trim()) {
        toast.error("Banner image is required");
        return;
      }
    }

    if (formData.startDate && formData.endDate) {
      if (new Date(formData.startDate) >= new Date(formData.endDate)) {
        toast.error("End date must be after start date");
        return;
      }
    }

    try {
      const bannerData = {
        ...formData,
        startDate: formData.startDate
          ? new Date(formData.startDate).toISOString()
          : null,
        endDate: formData.endDate
          ? new Date(formData.endDate).toISOString()
          : null,
        order: parseInt(formData.order) || 1,
      };

      if (isEdit) {
        await updateBanner(banner._id, bannerData);
      } else {
        await createBanner(bannerData);
      }
      onSave?.();
      onClose();
    } catch (error) {
      // Error handled in store
    }
  };

  return (
    <AnimatePresence>
      <>
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/50 z-[10000]"
        />

        {/* Modal Content - Mobile: Slide up from bottom, Desktop: Center with scale */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`fixed inset-0 z-[10000] flex ${isAppRoute ? "items-start pt-[10px]" : "items-end"
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
            className={`bg-white ${isAppRoute ? "rounded-b-3xl" : "rounded-t-3xl"
              } sm:rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto scrollbar-admin pointer-events-auto`}
            style={{ willChange: "transform" }}>
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between z-10">
              <h2 className="text-2xl font-bold text-gray-800">
                {isEdit ? "Edit Banner" : "Create Banner"}
              </h2>
              <Button
                onClick={onClose}
                variant="icon"
                icon={FiX}
                className="text-gray-600"
              />
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-4">
                  Basic Information
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Banner Type <span className="text-red-500">*</span>
                    </label>
                    <AnimatedSelect
                      name="type"
                      value={formData.type}
                      onChange={handleChange}
                      required
                      options={[
                        { value: "home_slider", label: "Home Slider" },
                        { value: "festival_offer", label: "Festival Offer Banner" },
                        { value: "banner", label: "Generic Banner" },
                        { value: "hero", label: "Hero Banner" },
                        { value: "promotional", label: "Promotional Banner" },
                        { value: "side_banner", label: "Side Banner (Home Right)" },
                      ]}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Title
                    </label>
                    <input
                      type="text"
                      name="title"
                      value={formData.title}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Banner title"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Subtitle
                    </label>
                    <input
                      type="text"
                      name="subtitle"
                      value={formData.subtitle}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Banner subtitle"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Description
                    </label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Banner description"
                    />
                  </div>
                </div>
              </div>

              {/* Media Settings (Image or Video) */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-800">
                    Banner Media
                  </h3>
                  {/* Media Type Segmented Control */}
                  <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200">
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, mediaType: "image" }))}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                        formData.mediaType === "image"
                          ? "bg-white text-primary-700 shadow-sm"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      <FiImage />
                      Image
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData((prev) => ({ ...prev, mediaType: "video" }))}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                        formData.mediaType === "video"
                          ? "bg-white text-primary-700 shadow-sm"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      <FiVideo />
                      Video
                    </button>
                  </div>
                </div>

                {formData.mediaType === "video" ? (
                  <div className="space-y-4">
                    {/* Video Upload & URL */}
                    <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4">
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Banner Video <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="video"
                        value={formData.video}
                        onChange={handleChange}
                        className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                        placeholder="https://res.cloudinary.com/.../banner.mp4 or data/banners/video.mp4"
                      />
                      <div className="mt-3 flex items-center gap-3 flex-wrap">
                        <label className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors cursor-pointer text-sm font-semibold shadow-sm">
                          <FiUpload />
                          {isUploadingVideo ? "Uploading Video..." : "Upload Video to Cloudinary"}
                          <input
                            type="file"
                            accept="video/mp4,video/webm,video/quicktime"
                            onChange={handleVideoUpload}
                            className="hidden"
                            disabled={isUploadingVideo}
                          />
                        </label>
                        <span className="text-xs text-gray-500">
                          Supports MP4, WebM, MOV (Max 50MB)
                        </span>
                      </div>

                      {/* Video Preview */}
                      {formData.video && (
                        <div className="mt-4 relative rounded-lg overflow-hidden border border-gray-200 bg-black/5">
                          <video
                            src={formData.video}
                            controls
                            muted
                            playsInline
                            className="w-full max-h-56 object-contain rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => setFormData((prev) => ({ ...prev, video: "" }))}
                            className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full hover:bg-red-600 transition-colors text-xs"
                            title="Remove Video"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Optional Poster / Thumbnail Image */}
                    <div className="pt-2">
                      <label className="block text-sm font-semibold text-gray-700 mb-1">
                        Video Poster / Thumbnail <span className="text-xs font-normal text-gray-500">(Optional fallback image)</span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          name="image"
                          value={formData.image}
                          onChange={handleChange}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                          placeholder="Image thumbnail URL (optional)"
                        />
                        <label className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer text-xs font-semibold whitespace-nowrap">
                          <FiUpload />
                          {isUploadingImage ? "..." : "Upload Image"}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                            disabled={isUploadingImage}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Image URL <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="image"
                      value={formData.image}
                      onChange={handleChange}
                      required={formData.mediaType === "image"}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                      placeholder="data/banners/banner.png or https://..."
                    />
                    <div className="mt-3 flex items-center gap-3 flex-wrap">
                      <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer text-sm font-semibold">
                        <FiUpload />
                        {isUploadingImage ? "Uploading..." : "Upload to Cloudinary"}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                          disabled={isUploadingImage}
                        />
                      </label>
                      <span className="text-xs text-gray-500">
                        Supports JPEG, PNG, WebP, GIF (Max 5MB)
                      </span>
                    </div>
                    {formData.image && (
                      <div className="mt-4 relative">
                        <img
                          src={formData.image}
                          alt="Preview"
                          className="w-full h-48 object-cover rounded-lg border border-gray-200"
                          onError={(e) => {
                            e.target.style.display = "none";
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, image: "" }))}
                          className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full hover:bg-red-600 transition-colors text-xs"
                          title="Remove Image"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Link */}
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-4">
                  Link Settings
                </h3>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Link URL
                  </label>
                  <input
                    type="text"
                    name="link"
                    value={formData.link}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="/category/electronics or https://example.com"
                  />
                </div>
              </div>

              {/* Schedule */}
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-4">
                  Schedule (Optional)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Start Date
                    </label>
                    <input
                      type="date"
                      name="startDate"
                      value={formData.startDate}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      End Date
                    </label>
                    <input
                      type="date"
                      name="endDate"
                      value={formData.endDate}
                      onChange={handleChange}
                      min={formData.startDate}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              </div>

              {/* Settings */}
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-4">
                  Settings
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Display Order
                    </label>
                    <input
                      type="number"
                      name="order"
                      value={formData.order}
                      onChange={handleChange}
                      min="1"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={formData.isActive}
                      onChange={handleChange}
                      className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                    />
                    <span className="text-sm font-semibold text-gray-700">
                      Active
                    </span>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-200">
                <Button type="button" onClick={onClose} variant="secondary">
                  Cancel
                </Button>
                <Button type="submit" variant="primary" icon={FiSave}>
                  {isEdit ? "Update Banner" : "Create Banner"}
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      </>
    </AnimatePresence>
  );
};

export default BannerForm;
