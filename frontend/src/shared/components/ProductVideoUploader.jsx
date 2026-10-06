import { useState } from "react";
import { FiFilm, FiX, FiLoader } from "react-icons/fi";
import toast from "react-hot-toast";

const MAX_VIDEOS = 3;
const MAX_VIDEO_MB = 50;
const ACCEPTED_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

/**
 * Upload product videos to Cloudinary through the given upload function.
 * `uploadFn(file)` must resolve to the API response whose `data.url` is the Cloudinary URL.
 */
const ProductVideoUploader = ({ videos = [], onChange, uploadFn, inputId = "product-video-upload" }) => {
  const [isUploading, setIsUploading] = useState(false);

  const handleSelect = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (videos.length >= MAX_VIDEOS) {
      toast.error(`You can add up to ${MAX_VIDEOS} videos`);
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Only MP4, WEBM and MOV videos are allowed");
      return;
    }
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      toast.error(`Video must be under ${MAX_VIDEO_MB} MB`);
      return;
    }

    setIsUploading(true);
    try {
      const res = await uploadFn(file);
      const url = res?.data?.url;
      if (!url) throw new Error("Upload failed");
      onChange([...videos, url]);
      toast.success("Video uploaded");
    } catch {
      // API errors are shown by the api interceptor.
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-2">Product Videos</h3>
      <input
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        onChange={handleSelect}
        className="hidden"
        id={inputId}
        disabled={isUploading || videos.length >= MAX_VIDEOS}
      />
      <label
        htmlFor={inputId}
        className={`flex items-center justify-center gap-2 w-full px-3 py-2 border-2 border-dashed border-primary-300 rounded-lg bg-white transition-colors ${
          isUploading || videos.length >= MAX_VIDEOS
            ? "opacity-60 cursor-not-allowed"
            : "cursor-pointer hover:border-primary-500 hover:bg-primary-50"
        }`}>
        {isUploading ? (
          <FiLoader className="text-base text-primary-600 animate-spin" />
        ) : (
          <FiFilm className="text-base text-primary-600" />
        )}
        <span className="text-xs font-medium text-gray-700">
          {isUploading ? "Uploading video..." : `Upload Video (MP4/WEBM/MOV, max ${MAX_VIDEO_MB} MB)`}
        </span>
      </label>

      {videos.length > 0 && (
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {videos.map((url, index) => (
            <div key={url} className="relative group">
              <video src={url} controls preload="metadata" className="w-full h-32 rounded-lg border-2 border-primary-300 bg-black object-contain" />
              <button
                type="button"
                onClick={() => onChange(videos.filter((_, i) => i !== index))}
                className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                title="Remove video">
                <FiX className="text-xs" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductVideoUploader;
