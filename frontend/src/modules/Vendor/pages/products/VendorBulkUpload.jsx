import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiFileText,
  FiUploadCloud,
  FiCheckCircle,
  FiAlertTriangle,
  FiDownload,
  FiPlus,
  FiTrash2,
  FiCopy,
  FiGrid,
  FiRefreshCw,
  FiArrowLeft,
  FiPackage,
  FiX,
  FiInfo,
  FiCheck,
  FiUpload,
  FiImage,
} from "react-icons/fi";
import toast from "react-hot-toast";
import { useCategoryStore } from "../../../../shared/store/categoryStore";
import { useBrandStore } from "../../../../shared/store/brandStore";
import {
  downloadBulkTemplate,
  validateBulkProducts,
  importBulkProducts,
  downloadBulkErrorReport,
  uploadVendorImage,
} from "../../services/vendorService";

const VendorBulkUpload = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const gridRowImageInputRef = useRef(null);
  const [activeImageUploadRowId, setActiveImageUploadRowId] = useState(null);
  const [isUploadingGridImage, setIsUploadingGridImage] = useState(false);

  const { categories, initialize: initCategories } = useCategoryStore();
  const { brands, initialize: initBrands } = useBrandStore();

  useEffect(() => {
    initCategories();
    initBrands();
  }, [initCategories, initBrands]);

  // Active Tab: 'excel' | 'grid'
  const [activeTab, setActiveTab] = useState("excel");

  // Grid Column Group Filter: 'all' | 'basic' | 'inventory' | 'flags'
  const [gridColumnView, setGridColumnView] = useState("all");

  // ── EXCEL UPLOAD STATE ──
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedExcelRows, setSelectedExcelRows] = useState(new Set());
  const [isDragOver, setIsDragOver] = useState(false);
  const [isValidatingFile, setIsValidatingFile] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
  const [isDownloadingErrors, setIsDownloadingErrors] = useState(false);

  // Validation Result: { totalRows, validRowsCount, invalidRowsCount, items: [ { rowNumber, rawData, resolvedData, isValid, errors } ] }
  const [validationResult, setValidationResult] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all"); // 'all' | 'valid' | 'invalid'
  const [importSummary, setImportSummary] = useState(null);

  const handleDeleteExcelRow = (rowNum) => {
    if (!validationResult) return;
    const nextItems = validationResult.items.filter((item) => item.rowNumber !== rowNum);
    const validCount = nextItems.filter((i) => i.isValid).length;
    const invalidCount = nextItems.length - validCount;

    setValidationResult({
      ...validationResult,
      totalRows: nextItems.length,
      validRowsCount: validCount,
      invalidRowsCount: invalidCount,
      items: nextItems,
    });
    setSelectedExcelRows((prev) => {
      const next = new Set(prev);
      next.delete(rowNum);
      return next;
    });
    toast.success(`Row #${rowNum} deleted`);
  };

  const handleDeleteSelectedExcelRows = () => {
    if (!validationResult || selectedExcelRows.size === 0) return;
    const nextItems = validationResult.items.filter((item) => !selectedExcelRows.has(item.rowNumber));
    const validCount = nextItems.filter((i) => i.isValid).length;
    const invalidCount = nextItems.length - validCount;

    setValidationResult({
      ...validationResult,
      totalRows: nextItems.length,
      validRowsCount: validCount,
      invalidRowsCount: invalidCount,
      items: nextItems,
    });
    setSelectedExcelRows(new Set());
    toast.success("Selected rows deleted from preview");
  };

  const handleDeleteAllExcelRows = () => {
    setValidationResult(null);
    setSelectedFile(null);
    setSelectedExcelRows(new Set());
    toast.success("All parsed products cleared");
  };

  const handleToggleSelectExcelRow = (rowNum) => {
    setSelectedExcelRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowNum)) next.delete(rowNum);
      else next.add(rowNum);
      return next;
    });
  };

  const handleToggleSelectAllExcel = () => {
    if (!validationResult?.items) return;
    if (selectedExcelRows.size === filteredPreviewItems.length) {
      setSelectedExcelRows(new Set());
    } else {
      setSelectedExcelRows(new Set(filteredPreviewItems.map((i) => i.rowNumber)));
    }
  };

  // ── MANUAL GRID STATE ──
  const createEmptyRow = (id) => ({
    id: id || Date.now() + Math.random(),
    name: "",
    categoryName: "",
    subcategoryName: "",
    brandName: "",
    price: "",
    originalPrice: "",
    unit: "Piece",
    stockQuantity: "10",
    lowStockThreshold: "10",
    minimumOrderQuantity: "1",
    totalAllowedQuantity: "",
    taxRate: "18",
    taxIncluded: false,
    hsnCode: "",
    warrantyPeriod: "",
    guaranteePeriod: "",
    weight: "0.5",
    length: "10",
    breadth: "10",
    height: "5",
    codAllowed: true,
    returnable: true,
    cancelable: true,
    flashSale: false,
    isNewArrival: false,
    isFeatured: false,
    isVisible: true,
    image: "",
    images: "",
    description: "",
    tags: "",
    seoTitle: "",
    seoDescription: "",
    sizes: "",
    colors: "",
    errors: {},
    isValid: true,
  });

  const [gridRows, setGridRows] = useState([
    createEmptyRow(1),
    createEmptyRow(2),
    createEmptyRow(3),
  ]);
  const [selectedGridRows, setSelectedGridRows] = useState(new Set());
  const [gridValidationSummary, setGridValidationSummary] = useState(null);

  // Parent Categories
  const parentCategories = useMemo(() => {
    return (categories || []).filter((c) => !c.parentId);
  }, [categories]);

  // Subcategories map
  const getSubcategories = (catName) => {
    if (!catName) return [];
    const matchedParent = categories.find(
      (c) => !c.parentId && c.name.toLowerCase() === catName.toLowerCase()
    );
    if (!matchedParent) return [];
    return categories.filter(
      (c) => String(c.parentId) === String(matchedParent.id || matchedParent._id)
    );
  };

  // ── TEMPLATE DOWNLOAD ──
  const handleDownloadTemplate = async () => {
    setIsDownloadingTemplate(true);
    try {
      const response = await downloadBulkTemplate();
      const blob = new Blob([response.data || response], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "Vendor_Bulk_Product_Upload_Template.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Complete Excel template downloaded!");
    } catch (err) {
      toast.error("Failed to download template. Please try again.");
    } finally {
      setIsDownloadingTemplate(false);
    }
  };

  // ── EXCEL FILE HANDLERS ──
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) validateAndSetFile(file);
  };

  const validateAndSetFile = (file) => {
    const validExtensions = [".xlsx", ".xls", ".csv"];
    const fileNameNameLower = file.name.toLowerCase();
    const isExtensionValid = validExtensions.some((ext) =>
      fileNameNameLower.endsWith(ext)
    );

    if (!isExtensionValid) {
      toast.error("Please select a valid Excel (.xlsx, .xls) or CSV file.");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      toast.error("File size exceeds 15MB limit.");
      return;
    }

    setSelectedFile(file);
    setValidationResult(null);
    setImportSummary(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndSetFile(file);
  };

  const handleValidateExcel = async () => {
    if (!selectedFile) {
      toast.error("Please select an Excel file to validate.");
      return;
    }

    setIsValidatingFile(true);
    setValidationResult(null);
    setImportSummary(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await validateBulkProducts(formData);
      const data = res?.data ?? res;

      setValidationResult(data);
      if (data.invalidRowsCount > 0) {
        toast.error(
          `Validation complete: ${data.validRowsCount} valid, ${data.invalidRowsCount} invalid rows found.`
        );
      } else {
        toast.success(
          `Validation successful! All ${data.validRowsCount} rows are ready for import.`
        );
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || "File validation failed";
      toast.error(msg);
    } finally {
      setIsValidatingFile(false);
    }
  };

  const handleImportValidProducts = async () => {
    if (!validationResult || validationResult.validRowsCount === 0) {
      toast.error("No valid products available to import.");
      return;
    }

    const validItems = validationResult.items.filter((item) => item.isValid);
    setIsImporting(true);

    try {
      const res = await importBulkProducts(validItems);
      const data = res?.data ?? res;

      setImportSummary(data);
      toast.success(`Successfully imported ${data.successCount} product(s)!`);
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || "Import failed";
      toast.error(msg);
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadErrorReport = async () => {
    if (!validationResult || validationResult.invalidRowsCount === 0) {
      toast.error("No error report needed — all rows are valid!");
      return;
    }

    const failedItems = validationResult.items.filter((item) => !item.isValid);
    setIsDownloadingErrors(true);

    try {
      const response = await downloadBulkErrorReport(failedItems);
      const blob = new Blob([response.data || response], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "Bulk_Upload_Error_Report.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Error report downloaded!");
    } catch (err) {
      toast.error("Failed to download error report.");
    } finally {
      setIsDownloadingErrors(false);
    }
  };

  // ── MANUAL GRID HANDLERS ──
  const handleGridCellChange = (id, field, value) => {
    setGridRows((prev) =>
      prev.map((row) => {
        if (row.id === id) {
          const updated = { ...row, [field]: value };
          if (field === "categoryName") {
            updated.subcategoryName = "";
          }
          if (updated.errors[field]) {
            const nextErrors = { ...updated.errors };
            delete nextErrors[field];
            updated.errors = nextErrors;
            updated.isValid = Object.keys(nextErrors).length === 0;
          }
          return updated;
        }
        return row;
      })
    );
    setGridValidationSummary(null);
  };

  // Trigger per-row image file upload
  const triggerRowImageUpload = (rowId) => {
    setActiveImageUploadRowId(rowId);
    if (gridRowImageInputRef.current) {
      gridRowImageInputRef.current.value = "";
      gridRowImageInputRef.current.click();
    }
  };

  const handleGridRowImageFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeImageUploadRowId) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB.");
      return;
    }

    setIsUploadingGridImage(true);
    try {
      const res = await uploadVendorImage(file, "vendors/products");
      const uploaded = res?.data ?? res;
      const imageUrl = uploaded?.url || "";

      if (imageUrl) {
        handleGridCellChange(activeImageUploadRowId, "image", imageUrl);
        toast.success("Image uploaded successfully!");
      }
    } catch (err) {
      toast.error("Failed to upload image.");
    } finally {
      setIsUploadingGridImage(false);
      setActiveImageUploadRowId(null);
    }
  };

  const handleAddGridRow = (count = 1) => {
    const newRows = Array.from({ length: count }, () => createEmptyRow());
    setGridRows((prev) => [...prev, ...newRows]);
    setGridValidationSummary(null);
  };

  const handleDuplicateGridRow = (id) => {
    const rowToDup = gridRows.find((r) => r.id === id);
    if (rowToDup) {
      const dup = {
        ...rowToDup,
        id: Date.now() + Math.random(),
        name: rowToDup.name ? `${rowToDup.name} (Copy)` : "",
      };
      setGridRows((prev) => [...prev, dup]);
      toast.success("Row duplicated");
    }
  };

  const handleDeleteGridRow = (id) => {
    if (gridRows.length <= 1) {
      toast.error("Grid must contain at least one row.");
      return;
    }
    setGridRows((prev) => prev.filter((r) => r.id !== id));
    setSelectedGridRows((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setGridValidationSummary(null);
  };

  const handleDeleteSelectedGridRows = () => {
    if (selectedGridRows.size === 0) return;
    if (gridRows.length - selectedGridRows.size < 1) {
      toast.error("At least one row must remain in the grid.");
      return;
    }
    setGridRows((prev) => prev.filter((r) => !selectedGridRows.has(r.id)));
    setSelectedGridRows(new Set());
    setGridValidationSummary(null);
    toast.success("Selected rows deleted");
  };

  const handleToggleSelectGridRow = (id) => {
    setSelectedGridRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAllGrid = () => {
    if (selectedGridRows.size === gridRows.length) {
      setSelectedGridRows(new Set());
    } else {
      setSelectedGridRows(new Set(gridRows.map((r) => r.id)));
    }
  };

  const handleValidateGrid = async () => {
    const nonEmptyRows = gridRows.filter(
      (r) => r.name.trim() || r.categoryName.trim() || r.price
    );

    if (!nonEmptyRows.length) {
      toast.error("Please fill in at least one product row.");
      return;
    }

    setIsValidatingFile(true);
    setGridValidationSummary(null);

    try {
      const payload = nonEmptyRows.map((row, idx) => ({
        rowNumber: idx + 1,
        ...row,
      }));

      const res = await validateBulkProducts({ products: payload });
      const data = res?.data ?? res;

      const updatedRows = [...gridRows];
      data.items.forEach((item) => {
        const rowIdx = item.rowNumber - 1;
        if (updatedRows[rowIdx]) {
          const errObj = {};
          (item.errors || []).forEach((e) => {
            errObj[e.field || "general"] = e.message;
          });
          updatedRows[rowIdx].errors = errObj;
          updatedRows[rowIdx].isValid = item.isValid;
        }
      });

      setGridRows(updatedRows);
      setGridValidationSummary(data);

      if (data.invalidRowsCount > 0) {
        toast.error(
          `Validation complete: ${data.validRowsCount} valid, ${data.invalidRowsCount} invalid rows found.`
        );
      } else {
        toast.success(
          `Validation successful! All ${data.validRowsCount} products are ready for submission.`
        );
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || "Grid validation failed";
      toast.error(msg);
    } finally {
      setIsValidatingFile(false);
    }
  };

  const handleSubmitGrid = async () => {
    if (!gridValidationSummary || gridValidationSummary.validRowsCount === 0) {
      toast.error("Please validate grid products first before submitting.");
      return;
    }

    const validItems = gridValidationSummary.items.filter((item) => item.isValid);
    setIsImporting(true);

    try {
      const res = await importBulkProducts(validItems);
      const data = res?.data ?? res;

      setImportSummary(data);
      toast.success(`Successfully submitted ${data.successCount} product(s)!`);
    } catch (err) {
      const msg = err?.response?.data?.message || err.message || "Submission failed";
      toast.error(msg);
    } finally {
      setIsImporting(false);
    }
  };

  const filteredPreviewItems = useMemo(() => {
    if (!validationResult?.items) return [];
    if (filterStatus === "valid") {
      return validationResult.items.filter((i) => i.isValid);
    }
    if (filterStatus === "invalid") {
      return validationResult.items.filter((i) => !i.isValid);
    }
    return validationResult.items;
  }, [validationResult, filterStatus]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-12 max-w-7xl mx-auto"
    >
      {/* Hidden file input for manual grid per-row image upload */}
      <input
        ref={gridRowImageInputRef}
        type="file"
        accept="image/*"
        onChange={handleGridRowImageFileChange}
        className="hidden"
      />

      {/* ── HEADER BAR ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <button
            onClick={() => navigate("/vendor/products")}
            className="inline-flex items-center text-xs font-semibold text-gray-500 hover:text-gray-800 mb-2 transition-colors"
          >
            <FiArrowLeft className="mr-1.5" /> Back to Products
          </button>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2.5">
            <FiPackage className="text-blue-600" /> Bulk Product Upload
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Import multiple products via complete Excel/CSV spreadsheet or interactive manual grid entry.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleDownloadTemplate}
            disabled={isDownloadingTemplate}
            className="inline-flex items-center px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 font-semibold text-xs hover:bg-gray-50 hover:border-gray-300 transition-all shadow-xs disabled:opacity-60"
          >
            <FiDownload className="mr-2 text-blue-600 text-sm" />
            {isDownloadingTemplate ? "Downloading..." : "Download Complete Excel Template"}
          </button>

          <button
            onClick={() => navigate("/vendor/products/manage-products")}
            className="inline-flex items-center px-4 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-xs hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20"
          >
            <FiPackage className="mr-2 text-sm" /> Manage Products
          </button>
        </div>
      </div>

      {/* ── TAB SWITCHER ── */}
      <div className="flex p-1.5 bg-gray-100/80 rounded-2xl border border-gray-200/80 max-w-md">
        <button
          onClick={() => {
            setActiveTab("excel");
            setImportSummary(null);
          }}
          className={`flex-1 flex items-center justify-center py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all duration-300 ${
            activeTab === "excel"
              ? "bg-white text-blue-600 shadow-md shadow-gray-200/80"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <FiFileText className="mr-2 text-base" /> Excel / CSV Upload
        </button>

        <button
          onClick={() => {
            setActiveTab("grid");
            setImportSummary(null);
          }}
          className={`flex-1 flex items-center justify-center py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm transition-all duration-300 ${
            activeTab === "grid"
              ? "bg-white text-blue-600 shadow-md shadow-gray-200/80"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          <FiGrid className="mr-2 text-base" /> Manual Grid Entry
        </button>
      </div>

      {/* ── POST-IMPORT SUCCESS MODAL / BANNER ── */}
      <AnimatePresence>
        {importSummary && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-gradient-to-br from-emerald-500 to-teal-700 text-white p-6 sm:p-8 rounded-3xl shadow-xl space-y-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-bold">
                  <FiCheckCircle />
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-extrabold">
                    Bulk Product Import Complete!
                  </h3>
                  <p className="text-emerald-100 text-xs sm:text-sm">
                    Your valid products have been created with all specified attributes.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setImportSummary(null)}
                className="text-white/80 hover:text-white p-2"
              >
                <FiX className="text-xl" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 bg-black/15 p-4 rounded-2xl text-center">
              <div>
                <div className="text-xs text-emerald-100 font-medium">Total Processed</div>
                <div className="text-2xl font-black mt-0.5">{importSummary.totalProcessed}</div>
              </div>
              <div>
                <div className="text-xs text-emerald-100 font-medium">Successfully Created</div>
                <div className="text-2xl font-black mt-0.5">{importSummary.successCount}</div>
              </div>
              <div>
                <div className="text-xs text-emerald-100 font-medium">Failed</div>
                <div className="text-2xl font-black mt-0.5">{importSummary.failedCount}</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={() => navigate("/vendor/products/manage-products")}
                className="px-5 py-2.5 bg-white text-emerald-800 font-bold rounded-xl text-xs hover:bg-emerald-50 transition-all shadow-md"
              >
                View Catalog Products
              </button>
              <button
                onClick={() => {
                  setImportSummary(null);
                  setValidationResult(null);
                  setSelectedFile(null);
                }}
                className="px-5 py-2.5 bg-emerald-800/60 text-white font-bold rounded-xl text-xs hover:bg-emerald-800 transition-all"
              >
                Upload Another Batch
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TAB 1: EXCEL / CSV UPLOAD ── */}
      {activeTab === "excel" && (
        <div className="space-y-6">
          <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-lg font-extrabold text-gray-900">
                  Step 1: Select & Upload File
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Upload an `.xlsx`, `.xls` or `.csv` spreadsheet containing your product details.
                </p>
              </div>

              <button
                onClick={handleDownloadTemplate}
                disabled={isDownloadingTemplate}
                className="text-blue-600 hover:text-blue-700 text-xs font-bold inline-flex items-center gap-1"
              >
                <FiDownload /> Download Instructions & Template
              </button>
            </div>

            {/* Drop Area */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center gap-3 ${
                isDragOver
                  ? "border-blue-500 bg-blue-50/50 scale-[0.99]"
                  : selectedFile
                  ? "border-emerald-300 bg-emerald-50/30"
                  : "border-gray-200 hover:border-blue-400 bg-gray-50/50 hover:bg-white"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl transition-transform duration-300 ${
                  selectedFile
                    ? "bg-emerald-100 text-emerald-700 scale-110"
                    : "bg-blue-100 text-blue-600"
                }`}
              >
                {selectedFile ? <FiFileText /> : <FiUploadCloud />}
              </div>

              {selectedFile ? (
                <div>
                  <div className="text-base font-extrabold text-gray-900">
                    {selectedFile.name}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {(selectedFile.size / 1024).toFixed(1)} KB • Click or drag to replace file
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-sm sm:text-base font-bold text-gray-800">
                    Drag and drop your Excel spreadsheet here, or{" "}
                    <span className="text-blue-600 underline">browse</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1.5">
                    Supports .xlsx, .xls, .csv files up to 15MB
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              {selectedFile && (
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    setValidationResult(null);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-xs font-bold hover:bg-gray-50"
                >
                  Clear File
                </button>
              )}

              <button
                onClick={handleValidateExcel}
                disabled={!selectedFile || isValidatingFile}
                className="inline-flex items-center px-6 py-3 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20 disabled:opacity-50"
              >
                {isValidatingFile ? (
                  <>
                    <FiRefreshCw className="mr-2 animate-spin text-sm" />
                    Parsing & Validating...
                  </>
                ) : (
                  <>
                    <FiCheckCircle className="mr-2 text-sm" />
                    Validate File
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Validation Preview Section */}
          {validationResult && (
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100 pb-4">
                <div>
                  <h2 className="text-lg font-extrabold text-gray-900">
                    Step 2: Preview Validation Results
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Review row-level validation status before committing to import.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {selectedExcelRows.size > 0 && (
                    <button
                      onClick={handleDeleteSelectedExcelRows}
                      className="inline-flex items-center px-3.5 py-2 rounded-xl bg-red-50 text-red-700 border border-red-200 font-bold text-xs hover:bg-red-100 transition-all"
                    >
                      <FiTrash2 className="mr-1.5" /> Delete Selected ({selectedExcelRows.size})
                    </button>
                  )}

                  <button
                    onClick={handleDeleteAllExcelRows}
                    className="inline-flex items-center px-3 py-2 rounded-xl bg-gray-100 text-gray-700 border border-gray-200 font-bold text-xs hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-all"
                  >
                    <FiTrash2 className="mr-1.5" /> Clear All Rows
                  </button>

                  {validationResult.invalidRowsCount > 0 && (
                    <button
                      onClick={handleDownloadErrorReport}
                      disabled={isDownloadingErrors}
                      className="inline-flex items-center px-3.5 py-2 rounded-xl bg-red-50 text-red-700 border border-red-200 font-bold text-xs hover:bg-red-100 transition-all disabled:opacity-60"
                    >
                      <FiDownload className="mr-1.5" />
                      {isDownloadingErrors ? "Downloading..." : "Download Error Report"}
                    </button>
                  )}

                  <button
                    onClick={handleImportValidProducts}
                    disabled={validationResult.validRowsCount === 0 || isImporting}
                    className="inline-flex items-center px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50"
                  >
                    {isImporting ? (
                      <>
                        <FiRefreshCw className="mr-2 animate-spin text-sm" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <FiCheck className="mr-2 text-sm" />
                        Confirm & Import ({validationResult.validRowsCount}) Valid Products
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Stats Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <div className="text-xs font-semibold text-gray-500">Total Rows</div>
                  <div className="text-2xl font-black text-gray-900 mt-1">
                    {validationResult.totalRows}
                  </div>
                </div>

                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                  <div className="text-xs font-semibold text-emerald-700">Valid Rows</div>
                  <div className="text-2xl font-black text-emerald-800 mt-1">
                    {validationResult.validRowsCount}
                  </div>
                </div>

                <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                  <div className="text-xs font-semibold text-red-700">Invalid Rows</div>
                  <div className="text-2xl font-black text-red-800 mt-1">
                    {validationResult.invalidRowsCount}
                  </div>
                </div>
              </div>

              {/* Preview Filter Tabs */}
              <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                <button
                  onClick={() => setFilterStatus("all")}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${
                    filterStatus === "all"
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  All Rows ({validationResult.totalRows})
                </button>
                <button
                  onClick={() => setFilterStatus("valid")}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${
                    filterStatus === "valid"
                      ? "bg-emerald-600 text-white"
                      : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  }`}
                >
                  Valid Only ({validationResult.validRowsCount})
                </button>
                <button
                  onClick={() => setFilterStatus("invalid")}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors ${
                    filterStatus === "invalid"
                      ? "bg-red-600 text-white"
                      : "bg-red-50 text-red-700 hover:bg-red-100"
                  }`}
                >
                  Invalid Only ({validationResult.invalidRowsCount})
                </button>
              </div>

              {/* Preview Table */}
              <div className="overflow-x-auto rounded-2xl border border-gray-200 max-h-96">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-gray-50 text-gray-600 uppercase font-bold sticky top-0 border-b border-gray-200 z-10">
                    <tr>
                      <th className="py-3 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={
                            filteredPreviewItems.length > 0 &&
                            selectedExcelRows.size === filteredPreviewItems.length
                          }
                          onChange={handleToggleSelectAllExcel}
                          className="rounded text-blue-600 focus:ring-0"
                        />
                      </th>
                      <th className="py-3 px-4">Row #</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Product Name</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Brand</th>
                      <th className="py-3 px-4">Price (₹)</th>
                      <th className="py-3 px-4">Stock</th>
                      <th className="py-3 px-4">Validation Errors / Details</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100 font-medium">
                    {filteredPreviewItems.map((item) => {
                      const isSelected = selectedExcelRows.has(item.rowNumber);

                      return (
                        <tr
                          key={item.rowNumber}
                          className={
                            isSelected
                              ? "bg-blue-50/70"
                              : item.isValid
                              ? "hover:bg-gray-50/50"
                              : "bg-red-50/40 hover:bg-red-50/70"
                          }
                        >
                          <td className="py-3 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectExcelRow(item.rowNumber)}
                              className="rounded text-blue-600 focus:ring-0"
                            />
                          </td>
                          <td className="py-3 px-4 font-bold text-gray-500">
                            #{item.rowNumber}
                          </td>
                          <td className="py-3 px-4">
                            {item.isValid ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                                <FiCheckCircle className="mr-1 text-xs" /> Valid
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 text-red-800">
                                <FiAlertTriangle className="mr-1 text-xs" /> Invalid
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-bold text-gray-900">
                            {item.resolvedData?.name || item.rawData?.['Product Name'] || '-'}
                          </td>
                          <td className="py-3 px-4 text-gray-700">
                            {item.resolvedData?.categoryName || item.rawData?.['Category'] || '-'}
                          </td>
                          <td className="py-3 px-4 text-gray-700">
                            {item.resolvedData?.brandName || item.rawData?.['Brand'] || '-'}
                          </td>
                          <td className="py-3 px-4 font-bold text-gray-900">
                            {item.resolvedData?.price !== undefined
                              ? `₹${item.resolvedData.price}`
                              : item.rawData?.['Price'] || '-'}
                          </td>
                          <td className="py-3 px-4 text-gray-700">
                            {item.resolvedData?.stockQuantity !== undefined
                              ? item.resolvedData.stockQuantity
                              : item.rawData?.['Stock Quantity'] || '-'}
                          </td>
                          <td className="py-3 px-4">
                            {item.isValid ? (
                              <span className="text-gray-400 italic">Ready for import</span>
                            ) : (
                              <div className="space-y-1">
                                {item.errors.map((err, eIdx) => (
                                  <div
                                    key={eIdx}
                                    className="text-red-700 font-semibold flex items-center gap-1"
                                  >
                                    <FiInfo className="shrink-0 text-red-500" />
                                    <span>{err.message}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              title="Delete Row"
                              onClick={() => handleDeleteExcelRow(item.rowNumber)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                            >
                              <FiTrash2 className="text-sm" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: MANUAL GRID ENTRY ── */}
      {activeTab === "grid" && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-lg font-extrabold text-gray-900">
                Interactive Product Grid
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Fill in all product fields below. Use the column view toggles to navigate sections smoothly.
              </p>
            </div>

            {/* Column Group View Toggles */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
              <button
                onClick={() => setGridColumnView("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  gridColumnView === "all"
                    ? "bg-white text-blue-600 shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                All Fields
              </button>
              <button
                onClick={() => setGridColumnView("basic")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  gridColumnView === "basic"
                    ? "bg-white text-blue-600 shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Basic & Pricing
              </button>
              <button
                onClick={() => setGridColumnView("inventory")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  gridColumnView === "inventory"
                    ? "bg-white text-blue-600 shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Inventory & Specs
              </button>
              <button
                onClick={() => setGridColumnView("flags")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  gridColumnView === "flags"
                    ? "bg-white text-blue-600 shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Flags & SEO
              </button>
            </div>

            {/* Grid Action Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleAddGridRow(1)}
                className="inline-flex items-center px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold transition-all"
              >
                <FiPlus className="mr-1 text-sm" /> Add 1 Row
              </button>

              <button
                onClick={() => handleAddGridRow(5)}
                className="inline-flex items-center px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold transition-all"
              >
                <FiPlus className="mr-1 text-sm" /> Add 5 Rows
              </button>

              {selectedGridRows.size > 0 && (
                <button
                  onClick={handleDeleteSelectedGridRows}
                  className="inline-flex items-center px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition-all"
                >
                  <FiTrash2 className="mr-1 text-sm" /> Delete ({selectedGridRows.size})
                </button>
              )}

              <button
                onClick={handleValidateGrid}
                disabled={isValidatingFile}
                className="inline-flex items-center px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-all shadow-sm disabled:opacity-50"
              >
                {isValidatingFile ? (
                  <FiRefreshCw className="mr-1.5 animate-spin" />
                ) : (
                  <FiCheckCircle className="mr-1.5" />
                )}
                Validate Grid
              </button>

              <button
                onClick={handleSubmitGrid}
                disabled={
                  !gridValidationSummary ||
                  gridValidationSummary.validRowsCount === 0 ||
                  isImporting
                }
                className="inline-flex items-center px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50"
              >
                {isImporting ? (
                  <FiRefreshCw className="mr-1.5 animate-spin" />
                ) : (
                  <FiCheck className="mr-1.5" />
                )}
                Submit Products
              </button>
            </div>
          </div>

          {/* Validation Summary Bar */}
          {gridValidationSummary && (
            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 p-4 rounded-2xl text-xs">
              <div className="flex items-center gap-4">
                <span className="font-bold text-blue-900">
                  Validation Summary:
                </span>
                <span className="text-gray-700">
                  Total: <strong>{gridValidationSummary.totalRows}</strong>
                </span>
                <span className="text-emerald-700 font-bold">
                  Valid: {gridValidationSummary.validRowsCount}
                </span>
                <span className="text-red-700 font-bold">
                  Invalid: {gridValidationSummary.invalidRowsCount}
                </span>
              </div>
              {gridValidationSummary.invalidRowsCount > 0 && (
                <span className="text-red-600 font-semibold italic">
                  Fix invalid cell errors highlighted in red before submitting.
                </span>
              )}
            </div>
          )}

          {/* Spreadsheet Table Container */}
          <div className="overflow-x-auto border border-gray-200 rounded-2xl max-h-[650px] shadow-xs">
            <table className="w-full text-left border-collapse text-xs min-w-[2200px]">
              <thead className="bg-slate-900 text-white uppercase font-bold sticky top-0 z-20">
                <tr>
                  <th className="py-3 px-3 w-10 text-center sticky left-0 bg-slate-900 z-30">
                    <input
                      type="checkbox"
                      checked={
                        gridRows.length > 0 &&
                        selectedGridRows.size === gridRows.length
                      }
                      onChange={handleToggleSelectAllGrid}
                      className="rounded text-blue-600 focus:ring-0"
                    />
                  </th>
                  <th className="py-3 px-2 w-10 text-center sticky left-10 bg-slate-900 z-30">#</th>

                  {/* Basic & Pricing Columns */}
                  {(gridColumnView === "all" || gridColumnView === "basic") && (
                    <>
                      <th className="py-3 px-3 min-w-[200px]">Product Name *</th>
                      <th className="py-3 px-3 min-w-[160px]">Category *</th>
                      <th className="py-3 px-3 min-w-[160px]">Subcategory</th>
                      <th className="py-3 px-3 min-w-[150px]">Brand</th>
                      <th className="py-3 px-3 min-w-[130px]">Price (₹) *</th>
                      <th className="py-3 px-3 min-w-[130px]">MRP (₹)</th>
                      <th className="py-3 px-3 min-w-[120px]">Unit</th>
                      <th className="py-3 px-3 min-w-[100px]">Tax %</th>
                      <th className="py-3 px-3 min-w-[120px]">Tax Inc.?</th>
                      <th className="py-3 px-3 min-w-[140px]">HSN Code</th>
                    </>
                  )}

                  {/* Main Image Column (with Upload File button) */}
                  <th className="py-3 px-3 min-w-[260px]">Main Image (URL / Upload)</th>

                  {/* Inventory & Shipping Columns */}
                  {(gridColumnView === "all" || gridColumnView === "inventory") && (
                    <>
                      <th className="py-3 px-3 min-w-[120px]">Stock *</th>
                      <th className="py-3 px-3 min-w-[130px]">Low Stock Th.</th>
                      <th className="py-3 px-3 min-w-[130px]">Min Order Qty</th>
                      <th className="py-3 px-3 min-w-[130px]">Max Order Qty</th>
                      <th className="py-3 px-3 min-w-[110px]">Weight (kg)</th>
                      <th className="py-3 px-3 min-w-[100px]">L (cm)</th>
                      <th className="py-3 px-3 min-w-[100px]">B (cm)</th>
                      <th className="py-3 px-3 min-w-[100px]">H (cm)</th>
                      <th className="py-3 px-3 min-w-[140px]">Warranty</th>
                      <th className="py-3 px-3 min-w-[140px]">Guarantee</th>
                    </>
                  )}

                  {/* Flags, SEO & Additional Text Columns */}
                  {(gridColumnView === "all" || gridColumnView === "flags") && (
                    <>
                      <th className="py-3 px-3 min-w-[100px]">COD?</th>
                      <th className="py-3 px-3 min-w-[100px]">Return?</th>
                      <th className="py-3 px-3 min-w-[100px]">Cancel?</th>
                      <th className="py-3 px-3 min-w-[110px]">Flash Sale?</th>
                      <th className="py-3 px-3 min-w-[110px]">New Arr.?</th>
                      <th className="py-3 px-3 min-w-[110px]">Featured?</th>
                      <th className="py-3 px-3 min-w-[110px]">Visible?</th>
                      <th className="py-3 px-3 min-w-[180px]">Extra Image URLs</th>
                      <th className="py-3 px-3 min-w-[200px]">Description</th>
                      <th className="py-3 px-3 min-w-[150px]">Tags</th>
                      <th className="py-3 px-3 min-w-[160px]">Sizes</th>
                      <th className="py-3 px-3 min-w-[160px]">Colors</th>
                      <th className="py-3 px-3 min-w-[160px]">SEO Title</th>
                      <th className="py-3 px-3 min-w-[200px]">SEO Description</th>
                    </>
                  )}

                  <th className="py-3 px-2 w-20 text-center sticky right-0 bg-slate-900 z-30">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {gridRows.map((row, index) => {
                  const isSelected = selectedGridRows.has(row.id);
                  const subcats = getSubcategories(row.categoryName);

                  return (
                    <tr
                      key={row.id}
                      className={`transition-colors ${
                        isSelected ? "bg-blue-50/60" : "hover:bg-gray-50/60"
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-2.5 px-3 text-center sticky left-0 bg-white z-10">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectGridRow(row.id)}
                          className="rounded text-blue-600 focus:ring-0"
                        />
                      </td>

                      {/* Index */}
                      <td className="py-2.5 px-2 text-center font-bold text-gray-400 sticky left-10 bg-white z-10">
                        {index + 1}
                      </td>

                      {/* BASIC & PRICING */}
                      {(gridColumnView === "all" || gridColumnView === "basic") && (
                        <>
                          {/* Name */}
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              placeholder="Product Title"
                              value={row.name}
                              onChange={(e) => handleGridCellChange(row.id, "name", e.target.value)}
                              className={`w-full py-1.5 px-2.5 rounded-lg border text-xs font-semibold focus:outline-none ${
                                row.errors.name ? "border-red-500 bg-red-50/50" : "border-gray-200 focus:border-blue-500"
                              }`}
                            />
                            {row.errors.name && <span className="text-[10px] text-red-600 font-bold block">{row.errors.name}</span>}
                          </td>

                          {/* Category */}
                          <td className="py-2 px-2">
                            <select
                              value={row.categoryName}
                              onChange={(e) => handleGridCellChange(row.id, "categoryName", e.target.value)}
                              className={`w-full py-1.5 px-2 rounded-lg border text-xs font-semibold focus:outline-none bg-white ${
                                row.errors.categoryName ? "border-red-500 bg-red-50/50" : "border-gray-200 focus:border-blue-500"
                              }`}
                            >
                              <option value="">-- Select Category --</option>
                              {parentCategories.map((cat) => (
                                <option key={cat.id || cat._id} value={cat.name}>
                                  {cat.name}
                                </option>
                              ))}
                            </select>
                            {row.errors.categoryName && <span className="text-[10px] text-red-600 font-bold block">{row.errors.categoryName}</span>}
                          </td>

                          {/* Subcategory */}
                          <td className="py-2 px-2">
                            <select
                              disabled={!row.categoryName}
                              value={row.subcategoryName}
                              onChange={(e) => handleGridCellChange(row.id, "subcategoryName", e.target.value)}
                              className="w-full py-1.5 px-2 rounded-lg border border-gray-200 text-xs font-semibold focus:outline-none bg-white disabled:bg-gray-100 disabled:text-gray-400"
                            >
                              <option value="">-- Subcategory --</option>
                              {subcats.map((sc) => (
                                <option key={sc.id || sc._id} value={sc.name}>
                                  {sc.name}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Brand */}
                          <td className="py-2 px-2">
                            <select
                              value={row.brandName}
                              onChange={(e) => handleGridCellChange(row.id, "brandName", e.target.value)}
                              className="w-full py-1.5 px-2 rounded-lg border border-gray-200 text-xs font-semibold focus:outline-none bg-white"
                            >
                              <option value="">-- Select Brand --</option>
                              {(brands || []).map((b) => (
                                <option key={b.id || b._id} value={b.name}>
                                  {b.name}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* Price */}
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              placeholder="Price"
                              min="0"
                              value={row.price}
                              onChange={(e) => handleGridCellChange(row.id, "price", e.target.value)}
                              className={`w-full py-1.5 px-3 rounded-lg border text-xs font-bold focus:outline-none min-w-[100px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                row.errors.price ? "border-red-500 bg-red-50/50" : "border-gray-200 focus:border-blue-500"
                              }`}
                            />
                            {row.errors.price && <span className="text-[10px] text-red-600 font-bold block">{row.errors.price}</span>}
                          </td>

                          {/* MRP */}
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              placeholder="MRP"
                              min="0"
                              value={row.originalPrice}
                              onChange={(e) => handleGridCellChange(row.id, "originalPrice", e.target.value)}
                              className="w-full py-1.5 px-3 rounded-lg border border-gray-200 text-xs font-semibold focus:outline-none min-w-[100px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </td>

                          {/* Unit */}
                          <td className="py-2 px-2">
                            <select
                              value={row.unit}
                              onChange={(e) => handleGridCellChange(row.id, "unit", e.target.value)}
                              className="w-full py-1.5 px-2.5 rounded-lg border border-gray-200 text-xs font-semibold focus:outline-none bg-white min-w-[90px]"
                            >
                              <option value="Piece">Piece</option>
                              <option value="Kg">Kg</option>
                              <option value="Gram">Gram</option>
                              <option value="Pack">Pack</option>
                              <option value="Box">Box</option>
                              <option value="Set">Set</option>
                              <option value="Litre">Litre</option>
                            </select>
                          </td>

                          {/* Tax % */}
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              placeholder="18"
                              min="0"
                              max="100"
                              value={row.taxRate}
                              onChange={(e) => handleGridCellChange(row.id, "taxRate", e.target.value)}
                              className="w-full py-1.5 px-2.5 rounded-lg border border-gray-200 text-xs font-semibold focus:outline-none min-w-[80px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </td>

                          {/* Tax Included */}
                          <td className="py-2 px-2">
                            <select
                              value={row.taxIncluded ? "Yes" : "No"}
                              onChange={(e) => handleGridCellChange(row.id, "taxIncluded", e.target.value === "Yes")}
                              className="w-full py-1.5 px-2.5 rounded-lg border border-gray-200 text-xs font-semibold focus:outline-none bg-white min-w-[90px]"
                            >
                              <option value="No">No</option>
                              <option value="Yes">Yes</option>
                            </select>
                          </td>

                          {/* HSN Code */}
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              placeholder="85183000"
                              value={row.hsnCode}
                              onChange={(e) => handleGridCellChange(row.id, "hsnCode", e.target.value)}
                              className="w-full py-1.5 px-2.5 rounded-lg border border-gray-200 text-xs font-semibold focus:outline-none min-w-[110px]"
                            />
                          </td>
                        </>
                      )}

                      {/* MAIN IMAGE (URL + FILE UPLOAD BUTTON) */}
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            placeholder="https://... image URL"
                            value={row.image}
                            onChange={(e) => handleGridCellChange(row.id, "image", e.target.value)}
                            className="flex-1 py-1.5 px-2.5 rounded-lg border border-gray-200 text-xs font-semibold focus:outline-none min-w-[150px]"
                          />
                          <button
                            type="button"
                            title="Upload Image File from Device"
                            onClick={() => triggerRowImageUpload(row.id)}
                            disabled={isUploadingGridImage && activeImageUploadRowId === row.id}
                            className="px-2.5 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0"
                          >
                            {isUploadingGridImage && activeImageUploadRowId === row.id ? (
                              <FiRefreshCw className="animate-spin text-xs" />
                            ) : (
                              <FiUpload className="text-xs" />
                            )}
                            Upload
                          </button>
                        </div>
                        {row.image && (
                          <div className="flex items-center gap-1.5 mt-1 text-[10px] text-emerald-700 font-bold">
                            <FiImage /> Image set
                          </div>
                        )}
                      </td>

                      {/* INVENTORY & SPECS */}
                      {(gridColumnView === "all" || gridColumnView === "inventory") && (
                        <>
                          {/* Stock Quantity */}
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              placeholder="Qty"
                              min="0"
                              value={row.stockQuantity}
                              onChange={(e) => handleGridCellChange(row.id, "stockQuantity", e.target.value)}
                              className={`w-full py-1.5 px-3 rounded-lg border text-xs font-semibold focus:outline-none min-w-[90px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
                                row.errors.stockQuantity ? "border-red-500 bg-red-50/50" : "border-gray-200 focus:border-blue-500"
                              }`}
                            />
                            {row.errors.stockQuantity && <span className="text-[10px] text-red-600 font-bold block">{row.errors.stockQuantity}</span>}
                          </td>

                          {/* Low Stock Threshold */}
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              placeholder="10"
                              min="0"
                              value={row.lowStockThreshold}
                              onChange={(e) => handleGridCellChange(row.id, "lowStockThreshold", e.target.value)}
                              className="w-full py-1.5 px-3 rounded-lg border border-gray-200 text-xs font-semibold focus:outline-none min-w-[90px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </td>

                          {/* Min Order Qty */}
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              placeholder="1"
                              min="1"
                              value={row.minimumOrderQuantity}
                              onChange={(e) => handleGridCellChange(row.id, "minimumOrderQuantity", e.target.value)}
                              className="w-full py-1.5 px-3 rounded-lg border border-gray-200 text-xs font-semibold focus:outline-none min-w-[90px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </td>

                          {/* Max Order Qty */}
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              placeholder="Optional"
                              min="1"
                              value={row.totalAllowedQuantity}
                              onChange={(e) => handleGridCellChange(row.id, "totalAllowedQuantity", e.target.value)}
                              className="w-full py-1.5 px-3 rounded-lg border border-gray-200 text-xs font-semibold focus:outline-none min-w-[90px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </td>

                          {/* Weight */}
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              placeholder="0.5"
                              step="0.01"
                              min="0"
                              value={row.weight}
                              onChange={(e) => handleGridCellChange(row.id, "weight", e.target.value)}
                              className="w-full py-1.5 px-3 rounded-lg border border-gray-200 text-xs font-semibold focus:outline-none min-w-[80px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </td>

                          {/* Length */}
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              placeholder="10"
                              min="0"
                              value={row.length}
                              onChange={(e) => handleGridCellChange(row.id, "length", e.target.value)}
                              className="w-full py-1.5 px-3 rounded-lg border border-gray-200 text-xs font-semibold focus:outline-none min-w-[70px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </td>

                          {/* Breadth */}
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              placeholder="10"
                              min="0"
                              value={row.breadth}
                              onChange={(e) => handleGridCellChange(row.id, "breadth", e.target.value)}
                              className="w-full py-1.5 px-3 rounded-lg border border-gray-200 text-xs font-semibold focus:outline-none min-w-[70px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </td>

                          {/* Height */}
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              placeholder="5"
                              min="0"
                              value={row.height}
                              onChange={(e) => handleGridCellChange(row.id, "height", e.target.value)}
                              className="w-full py-1.5 px-3 rounded-lg border border-gray-200 text-xs font-semibold focus:outline-none min-w-[70px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </td>

                          {/* Warranty Period */}
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              placeholder="e.g. 1 Year"
                              value={row.warrantyPeriod}
                              onChange={(e) => handleGridCellChange(row.id, "warrantyPeriod", e.target.value)}
                              className="w-full py-1.5 px-2 rounded-lg border border-gray-200 text-xs font-semibold focus:outline-none"
                            />
                          </td>

                          {/* Guarantee Period */}
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              placeholder="e.g. 6 Months"
                              value={row.guaranteePeriod}
                              onChange={(e) => handleGridCellChange(row.id, "guaranteePeriod", e.target.value)}
                              className="w-full py-1.5 px-2 rounded-lg border border-gray-200 text-xs font-semibold focus:outline-none"
                            />
                          </td>
                        </>
                      )}

                      {/* FLAGS, SEO & EXTRA TEXT */}
                      {(gridColumnView === "all" || gridColumnView === "flags") && (
                        <>
                          {/* COD */}
                          <td className="py-2 px-2">
                            <select
                              value={row.codAllowed ? "Yes" : "No"}
                              onChange={(e) => handleGridCellChange(row.id, "codAllowed", e.target.value === "Yes")}
                              className="w-full py-1.5 px-2 rounded-lg border border-gray-200 text-xs font-semibold focus:outline-none bg-white"
                            >
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                            </select>
                          </td>

                          {/* Returnable */}
                          <td className="py-2 px-2">
                            <select
                              value={row.returnable ? "Yes" : "No"}
                              onChange={(e) => handleGridCellChange(row.id, "returnable", e.target.value === "Yes")}
                              className="w-full py-1.5 px-2 rounded-lg border border-gray-200 text-xs font-semibold focus:outline-none bg-white"
                            >
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                            </select>
                          </td>

                          {/* Cancelable */}
                          <td className="py-2 px-2">
                            <select
                              value={row.cancelable ? "Yes" : "No"}
                              onChange={(e) => handleGridCellChange(row.id, "cancelable", e.target.value === "Yes")}
                              className="w-full py-1.5 px-2 rounded-lg border border-gray-200 text-xs font-semibold focus:outline-none bg-white"
                            >
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                            </select>
                          </td>

                          {/* Flash Sale */}
                          <td className="py-2 px-2">
                            <select
                              value={row.flashSale ? "Yes" : "No"}
                              onChange={(e) => handleGridCellChange(row.id, "flashSale", e.target.value === "Yes")}
                              className="w-full py-1.5 px-2 rounded-lg border border-gray-200 text-xs font-semibold focus:outline-none bg-white"
                            >
                              <option value="No">No</option>
                              <option value="Yes">Yes</option>
                            </select>
                          </td>

                          {/* New Arrival */}
                          <td className="py-2 px-2">
                            <select
                              value={row.isNewArrival ? "Yes" : "No"}
                              onChange={(e) => handleGridCellChange(row.id, "isNewArrival", e.target.value === "Yes")}
                              className="w-full py-1.5 px-2 rounded-lg border border-gray-200 text-xs font-semibold focus:outline-none bg-white"
                            >
                              <option value="No">No</option>
                              <option value="Yes">Yes</option>
                            </select>
                          </td>

                          {/* Featured */}
                          <td className="py-2 px-2">
                            <select
                              value={row.isFeatured ? "Yes" : "No"}
                              onChange={(e) => handleGridCellChange(row.id, "isFeatured", e.target.value === "Yes")}
                              className="w-full py-1.5 px-2 rounded-lg border border-gray-200 text-xs font-semibold focus:outline-none bg-white"
                            >
                              <option value="No">No</option>
                              <option value="Yes">Yes</option>
                            </select>
                          </td>

                          {/* Visible */}
                          <td className="py-2 px-2">
                            <select
                              value={row.isVisible ? "Yes" : "No"}
                              onChange={(e) => handleGridCellChange(row.id, "isVisible", e.target.value === "Yes")}
                              className="w-full py-1.5 px-2 rounded-lg border border-gray-200 text-xs font-semibold focus:outline-none bg-white"
                            >
                              <option value="Yes">Yes</option>
                              <option value="No">No</option>
                            </select>
                          </td>

                          {/* Extra Images */}
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              placeholder="URL1, URL2"
                              value={row.images}
                              onChange={(e) => handleGridCellChange(row.id, "images", e.target.value)}
                              className="w-full py-1.5 px-2 rounded-lg border border-gray-200 text-xs font-semibold focus:outline-none"
                            />
                          </td>

                          {/* Description */}
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              placeholder="Product description..."
                              value={row.description}
                              onChange={(e) => handleGridCellChange(row.id, "description", e.target.value)}
                              className="w-full py-1.5 px-2 rounded-lg border border-gray-200 text-xs font-semibold focus:outline-none"
                            />
                          </td>

                          {/* Tags */}
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              placeholder="tag1, tag2"
                              value={row.tags}
                              onChange={(e) => handleGridCellChange(row.id, "tags", e.target.value)}
                              className="w-full py-1.5 px-2 rounded-lg border border-gray-200 text-xs font-semibold focus:outline-none"
                            />
                          </td>

                          {/* Sizes */}
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              placeholder="S, M, L, XL"
                              value={row.sizes}
                              onChange={(e) => handleGridCellChange(row.id, "sizes", e.target.value)}
                              className="w-full py-1.5 px-2 rounded-lg border border-gray-200 text-xs font-semibold focus:outline-none"
                            />
                          </td>

                          {/* Colors */}
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              placeholder="Red, Blue, Black"
                              value={row.colors}
                              onChange={(e) => handleGridCellChange(row.id, "colors", e.target.value)}
                              className="w-full py-1.5 px-2 rounded-lg border border-gray-200 text-xs font-semibold focus:outline-none"
                            />
                          </td>

                          {/* SEO Title */}
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              placeholder="SEO Title"
                              value={row.seoTitle}
                              onChange={(e) => handleGridCellChange(row.id, "seoTitle", e.target.value)}
                              className="w-full py-1.5 px-2 rounded-lg border border-gray-200 text-xs font-semibold focus:outline-none"
                            />
                          </td>

                          {/* SEO Description */}
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              placeholder="SEO Description"
                              value={row.seoDescription}
                              onChange={(e) => handleGridCellChange(row.id, "seoDescription", e.target.value)}
                              className="w-full py-1.5 px-2 rounded-lg border border-gray-200 text-xs font-semibold focus:outline-none"
                            />
                          </td>
                        </>
                      )}

                      {/* Row Actions */}
                      <td className="py-2 px-2 text-center sticky right-0 bg-white z-10">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            title="Duplicate Row"
                            onClick={() => handleDuplicateGridRow(row.id)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <FiCopy />
                          </button>
                          <button
                            title="Delete Row"
                            onClick={() => handleDeleteGridRow(row.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <FiTrash2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Grid Footer Controls */}
          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => handleAddGridRow(1)}
              className="inline-flex items-center text-xs font-bold text-blue-600 hover:text-blue-700"
            >
              <FiPlus className="mr-1 text-sm" /> Add Another Product Row
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={handleValidateGrid}
                disabled={isValidatingFile}
                className="inline-flex items-center px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20 disabled:opacity-50"
              >
                {isValidatingFile ? "Validating..." : "Validate Products"}
              </button>

              <button
                onClick={handleSubmitGrid}
                disabled={
                  !gridValidationSummary ||
                  gridValidationSummary.validRowsCount === 0 ||
                  isImporting
                }
                className="inline-flex items-center px-6 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50"
              >
                {isImporting ? "Submitting..." : "Submit Valid Products"}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default VendorBulkUpload;
