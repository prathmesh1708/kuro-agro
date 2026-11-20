import { useState, useRef, useEffect } from "react";
import { getPlaceholderImage } from "../utils/helpers";

// Spacing and transform classes belong to the wrapper only; applying them to the <img> as well
// doubled the padding (shrinking the image) and compounded hover zoom.
const WRAPPER_ONLY_CLASS = /^(?:[a-z0-9-]+:)*-?(?:p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|scale|scale-x|scale-y|translate-x|translate-y|rotate)-/;
const toImageClassName = (className = "") =>
  className
    .split(/\s+/)
    .filter((cls) => cls && !WRAPPER_ONLY_CLASS.test(cls))
    .join(" ");

// Ask Cloudinary for an auto-format (WebP/AVIF), auto-quality, size-capped version of the image.
// Original uploads are often several MB; this typically cuts them by 70-90% with no visible loss.
const CLOUDINARY_UPLOAD = /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(?!.*\b(?:f_|q_)auto)/;
export const optimizeImageUrl = (url, width = 800) => {
  if (typeof url !== "string" || !CLOUDINARY_UPLOAD.test(url)) return url;
  return url.replace(CLOUDINARY_UPLOAD, `$1f_auto,q_auto,c_limit,w_${width}/`);
};

const LazyImage = ({
  src,
  alt,
  className,
  onError,
  placeholderWidth = 200,
  placeholderHeight = 200,
  placeholderText,
  // Width (px) requested from Cloudinary. 400 suits cards at 2x pixel density; pass more for big images.
  imageWidth = 400,
  // Above-the-fold images (e.g. first hero slide) skip lazy loading and download at high priority.
  priority = false,
  // Load straight away at normal priority (e.g. carousel slides hidden off to the side, which
  // the viewport observer would otherwise only fetch when the slide rotates into view).
  eager = false,
  ...props
}) => {
  const [imageSrc, setImageSrc] = useState(() => (priority || eager ? optimizeImageUrl(src, imageWidth) : null));
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [fallbackSrc, setFallbackSrc] = useState(null);
  const imgRef = useRef(null);

  useEffect(() => {
    if (priority || eager) {
      setImageSrc(optimizeImageUrl(src, imageWidth));
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setImageSrc(optimizeImageUrl(src, imageWidth));
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: "300px", // Start loading a bit before the image scrolls into view
        threshold: 0.01,
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      if (imgRef.current) {
        observer.unobserve(imgRef.current);
      }
      observer.disconnect();
    };
  }, [src, imageWidth, priority, eager]);

  const handleLoad = () => {
    setIsLoaded(true);
    setHasError(false);
  };

  const handleError = (e) => {
    // If we haven't tried a fallback yet, use the placeholder
    if (!fallbackSrc) {
      const placeholder = getPlaceholderImage(
        placeholderWidth,
        placeholderHeight,
        placeholderText || alt || "Image"
      );
      setFallbackSrc(placeholder);
      setImageSrc(placeholder);
      setHasError(false);
      setIsLoaded(false);
      return;
    }

    // If fallback also failed, show error state
    setHasError(true);
    setIsLoaded(false);
    if (onError) {
      onError(e);
    }
  };

  return (
    <div className={`relative overflow-hidden ${className || ""}`} ref={imgRef}>
      {/* Placeholder/Blur effect */}
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 animate-pulse"></div>
      )}

      {/* Actual Image */}
      {imageSrc && (
        <img
          src={imageSrc}
          alt={alt}
          className={`transition-opacity duration-300 ${
            isLoaded ? "opacity-100" : "opacity-0"
          } ${toImageClassName(className)}`}
          onLoad={handleLoad}
          onError={handleError}
          loading={priority || eager ? "eager" : "lazy"}
          fetchpriority={priority ? "high" : "auto"}
          decoding="async"
          {...props}
        />
      )}

      {/* Error Fallback - Only show if both original and placeholder failed */}
      {hasError && fallbackSrc && (
        <div className="absolute inset-0 bg-gray-200 flex items-center justify-center">
          <span className="text-gray-400 text-xs">Failed to load</span>
        </div>
      )}
    </div>
  );
};

export default LazyImage;
