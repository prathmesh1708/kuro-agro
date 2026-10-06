import { useState, useEffect, useMemo } from "react";
import { FiCheck } from "react-icons/fi";
import { formatPrice } from "../../utils/helpers";
import { getVariantSignature } from "../../utils/variant";

const normalizeAxisName = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

const toEntries = (value) => {
  if (!value) return [];
  if (value instanceof Map) return Array.from(value.entries());
  if (typeof value === "object") return Object.entries(value);
  return [];
};

const VariantSelector = ({ variants, onVariantChange, currentPrice, highlightFields = [] }) => {
  const [selectedVariant, setSelectedVariant] = useState({});

  const axes = useMemo(() => {
    const dynamicAxes = Array.isArray(variants?.attributes)
      ? variants.attributes
          .map((attr) => ({
            label: String(attr?.name || "").trim(),
            key: normalizeAxisName(attr?.name),
            values: Array.isArray(attr?.values) ? attr.values : [],
          }))
          .filter((attr) => attr.label && attr.key && attr.values.length > 0)
      : [];
    if (dynamicAxes.length) return dynamicAxes;

    const fallback = [];
    const sizes = Array.isArray(variants?.sizes) ? variants.sizes : [];
    const colors = Array.isArray(variants?.colors) ? variants.colors : [];
    if (sizes.length) fallback.push({ label: "Size", key: "size", values: sizes });
    if (colors.length) fallback.push({ label: "Color", key: "color", values: colors });
    return fallback;
  }, [variants]);

  const getVariantStockValue = (selection) => {
    const entries = toEntries(variants?.stockMap);
    if (!entries.length) return null;
    const key = getVariantSignature(selection);
    if (!key) return null;

    const exact = entries.find(([rawKey]) => String(rawKey).trim() === key);
    if (exact) {
      const parsed = Number(exact[1]);
      if (Number.isFinite(parsed)) return parsed;
    }
    const normalized = entries.find(
      ([rawKey]) => String(rawKey).trim().toLowerCase() === key.toLowerCase()
    );
    if (normalized) {
      const parsed = Number(normalized[1]);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  };

  useEffect(() => {
    const nextSelection = {};
    const defaultSelection = variants?.defaultSelection && typeof variants.defaultSelection === "object"
      ? variants.defaultSelection
      : {};
    axes.forEach((axis) => {
      const directDefault = String(defaultSelection?.[axis.key] || "").trim();
      const legacyDefault = axis.key === "size"
        ? String(variants?.defaultVariant?.size || "").trim()
        : axis.key === "color"
        ? String(variants?.defaultVariant?.color || "").trim()
        : "";
      const selected = directDefault || legacyDefault;
      if (selected) nextSelection[axis.key] = selected;
    });
    setSelectedVariant(nextSelection);
  }, [axes, variants]);

  useEffect(() => {
    onVariantChange?.(selectedVariant || {});
  }, [selectedVariant, onVariantChange]);

  if (!axes.length) return null;

  const handleOptionSelect = (axisKey, value) => {
    setSelectedVariant((prev) => {
      const isSame = String(prev?.[axisKey] || "") === String(value || "");
      const next = { ...(prev || {}) };
      if (isSame) {
        delete next[axisKey];
      } else {
        next[axisKey] = value;
      }
      return next;
    });
  };

  const isOptionAvailable = (axisKey, value) => {
    const previewSelection = { ...(selectedVariant || {}), [axisKey]: value };
    const stock = getVariantStockValue(previewSelection);
    return stock === null ? true : stock > 0;
  };

  const getVariantPrice = () => {
    const base = Number(currentPrice) || 0;
    const entries = toEntries(variants?.prices);
    if (!entries.length) return base;
    const key = getVariantSignature(selectedVariant || {});
    if (!key) return base;
    const exact = entries.find(([rawKey]) => String(rawKey).trim() === key);
    if (exact) {
      const parsed = Number(exact[1]);
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
    const normalized = entries.find(
      ([rawKey]) => String(rawKey).trim().toLowerCase() === key.toLowerCase()
    );
    if (normalized) {
      const parsed = Number(normalized[1]);
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
    return base;
  };

  const getColorGradient = (colorName) => {
    const name = String(colorName || '').trim().toLowerCase();
    if (name.includes('rose gold') || name.includes('rosegold')) {
      return 'bg-gradient-to-br from-[#ecc19c] via-[#b76e79] to-[#8c525a]';
    }
    if (name.includes('silver')) {
      return 'bg-gradient-to-br from-[#f3f4f6] via-[#cbd5e1] to-[#94a3b8]';
    }
    if (name.includes('gunmetal') || name.includes('gun metal')) {
      return 'bg-gradient-to-br from-[#555a64] via-[#333945] to-[#1a1f29]';
    }
    if (name.includes('gold')) {
      return 'bg-gradient-to-br from-[#fde047] via-[#eab308] to-[#ca8a04]';
    }
    if (name.includes('black')) return 'bg-black';
    if (name.includes('white')) return 'bg-white border border-gray-300';
    if (name.includes('red')) return 'bg-red-500';
    if (name.includes('blue')) return 'bg-blue-500';
    if (name.includes('green')) return 'bg-green-500';
    return 'bg-gray-400';
  };

  return (
    <div className="space-y-6">
      {axes.map((axis) => {
        const isColor = axis.key === 'color' || axis.label.toLowerCase() === 'color';
        const isHighlighted = highlightFields.includes(axis.label) || highlightFields.includes(axis.key);
        return (
          <div
            key={axis.key}
            className={`transition-all duration-300 ${
              isHighlighted
                ? "animate-shake border-2 border-red-500/80 shadow-[0_0_15px_rgba(239,68,68,0.15)] rounded-2xl p-4 bg-red-50/20"
                : ""
            }`}
          >
            <label className="block text-sm font-bold text-gray-700 mb-3">
              {axis.label}:{" "}
              <span className="font-normal text-gray-600">
                {selectedVariant?.[axis.key] || `Select ${axis.label.toLowerCase()}`}
              </span>
            </label>
            <div className="flex flex-wrap gap-3">
              {axis.values.map((option) => {
                const isSelected = selectedVariant?.[axis.key] === option;
                const isAvailable = isOptionAvailable(axis.key, option);
                return (
                  <button
                    key={`${axis.key}-${option}`}
                    onClick={() => handleOptionSelect(axis.key, option)}
                    disabled={!isAvailable}
                    className={`relative px-4 py-2.5 rounded-xl font-bold border-2 transition-all duration-300 flex items-center gap-2 ${
                      isSelected
                        ? isColor
                          ? "border-[#b89564] bg-[#b89564]/5 text-gray-900"
                          : "border-primary-600 bg-primary-50 text-primary-700"
                        : isAvailable
                        ? "border-gray-200 hover:border-[#b89564]/50 bg-white text-gray-700"
                        : "border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed opacity-50"
                    }`}
                  >
                    {isColor && (
                      <span
                        className={`w-5 h-5 rounded-full border border-gray-300/80 shadow-inner flex items-center justify-center flex-shrink-0 ${getColorGradient(option)}`}
                      >
                        {isSelected && <FiCheck className="text-white text-[10px] font-extrabold stroke-[4]" />}
                      </span>
                    )}
                    <span>{option}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {getVariantPrice() !== Number(currentPrice || 0) && (
        <div className="p-4 bg-primary-50 rounded-xl border border-primary-200">
          <p className="text-sm text-gray-600 mb-1">Selected variant price:</p>
          <p className="text-xl font-bold text-primary-700">{formatPrice(getVariantPrice())}</p>
        </div>
      )}
    </div>
  );
};

export default VariantSelector;

