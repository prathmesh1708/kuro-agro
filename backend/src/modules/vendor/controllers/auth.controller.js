import asyncHandler from '../../../utils/asyncHandler.js';
import ApiResponse from '../../../utils/ApiResponse.js';
import ApiError from '../../../utils/ApiError.js';
import Vendor from '../../../models/Vendor.model.js';
import Admin from '../../../models/Admin.model.js';
import Category from '../../../models/Category.model.js';
import { generateTokens } from '../../../utils/generateToken.js';
import { sendOTP } from '../../../services/otp.service.js';
import { createNotification } from '../../../services/notification.service.js';
import { sendEmail } from '../../../services/email.service.js';
import {
    clearRefreshSession,
    decodeRefreshTokenOrThrow,
    persistRefreshSession,
    rotateRefreshSession,
} from '../../../services/refreshToken.service.js';

// POST /api/vendor/auth/register
export const register = asyncHandler(async (req, res) => {
    const { 
        name, 
        email, 
        phone, 
        password,
        storeName, 
        storeDescription, 
        address, 
        categories, 
        fssaiLicenseNumber,
        businessType,
        legalBusinessName,
        gstin,
        panNumber,
        businessAddress
    } = req.body;

    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedPhone = String(phone || '').replace(/\D/g, '').slice(-10);

    if (!normalizedPhone || normalizedPhone.length !== 10) {
        throw new ApiError(400, 'Please provide a valid 10-digit mobile number.');
    }

    const existing = await Vendor.findOne({
        $or: [
            { email: normalizedEmail },
            { phone: normalizedPhone }
        ]
    });
    if (existing) {
        if (existing.email === normalizedEmail) throw new ApiError(409, 'Email already registered.');
        throw new ApiError(409, 'Phone number already registered.');
    }

    const categoriesArray = Array.isArray(categories) ? categories : [];
    if (categoriesArray.length === 0) {
        throw new ApiError(400, 'At least one product category is required.');
    }

    // Check if food category is selected (by name or slug 'food')
    const dbCategories = await Category.find({ _id: { $in: categoriesArray } });
    const hasFoodCategory = dbCategories.some(
        (cat) =>
            String(cat.name || '').toLowerCase() === 'food' ||
            String(cat.slug || '').toLowerCase() === 'food'
    );

    const { uploadLocalFileToCloudinaryAndCleanup } = await import('../../../services/upload.service.js');

    let fssaiFile = undefined;
    if (hasFoodCategory) {
        if (!fssaiLicenseNumber || !String(fssaiLicenseNumber).trim()) {
            throw new ApiError(400, 'FSSAI License Number is required for food category.');
        }
        fssaiFile = req.files?.fssaiLicenseDocument?.[0];
        if (!fssaiFile) {
            throw new ApiError(400, 'FSSAI License Document file is required for food category.');
        }
    }

    let gstCertFile = undefined;
    let panCardFile = undefined;

    if (businessType === 'gst') {
        if (!gstin || !String(gstin).trim()) {
            throw new ApiError(400, 'GSTIN is required for GST Registered sellers.');
        }
        if (!legalBusinessName || !String(legalBusinessName).trim()) {
            throw new ApiError(400, 'Legal Business Name is required for GST Registered sellers.');
        }
        if (!panNumber || !String(panNumber).trim()) {
            throw new ApiError(400, 'PAN Number is required.');
        }
        gstCertFile = req.files?.gstCertificate?.[0];
        panCardFile = req.files?.panCardDocument?.[0];
        if (!gstCertFile) {
            throw new ApiError(400, 'GST Certificate file is required for GST Registered sellers.');
        }
        if (!panCardFile) {
            throw new ApiError(400, 'PAN Card Document file is required.');
        }
    } else {
        if (!panNumber || !String(panNumber).trim()) {
            throw new ApiError(400, 'PAN Number is required.');
        }
        panCardFile = req.files?.panCardDocument?.[0];
        if (!panCardFile) {
            throw new ApiError(400, 'PAN Card Document file is required.');
        }
    }

    // Parallelize Cloudinary uploads
    const uploadPromises = [];
    let fssaiIndex = -1;
    let gstIndex = -1;
    let panIndex = -1;

    if (fssaiFile) {
        fssaiIndex = uploadPromises.length;
        uploadPromises.push(uploadLocalFileToCloudinaryAndCleanup(fssaiFile.path, 'vendors/documents'));
    }
    if (gstCertFile) {
        gstIndex = uploadPromises.length;
        uploadPromises.push(uploadLocalFileToCloudinaryAndCleanup(gstCertFile.path, 'vendors/documents'));
    }
    if (panCardFile) {
        panIndex = uploadPromises.length;
        uploadPromises.push(uploadLocalFileToCloudinaryAndCleanup(panCardFile.path, 'vendors/documents'));
    }

    const uploadResults = await Promise.all(uploadPromises);

    const fssaiLicenseDocument = fssaiIndex !== -1 ? uploadResults[fssaiIndex].url : undefined;
    const gstCertificateUrl = gstIndex !== -1 ? uploadResults[gstIndex].url : undefined;
    const panCardDocumentUrl = panIndex !== -1 ? uploadResults[panIndex].url : undefined;

    const vendor = await Vendor.create({
        name: String(name || '').trim(),
        email: normalizedEmail,
        phone: normalizedPhone,
        password: password || undefined,
        storeName: String(storeName || '').trim(),
        storeDescription: String(storeDescription || '').trim(),
        address,
        businessAddress,
        categories: categoriesArray,
        fssaiLicenseNumber: hasFoodCategory ? String(fssaiLicenseNumber).trim() : undefined,
        fssaiLicenseDocument: hasFoodCategory ? fssaiLicenseDocument : undefined,
        businessType: businessType || 'non-gst',
        legalBusinessName: businessType === 'gst' ? String(legalBusinessName || '').trim() : undefined,
        gstin: businessType === 'gst' ? String(gstin || '').trim() : undefined,
        panNumber: String(panNumber || '').trim(),
        gstCertificate: gstCertificateUrl,
        panCardDocument: panCardDocumentUrl,
        status: 'pending',
        verificationTimeline: [{
            status: 'pending',
            remarks: 'Account registered. Phone SMS verification OTP sent.',
            updatedByName: 'System',
            updatedAt: new Date()
        }],
        verificationAuditLog: [{
            action: 'register',
            details: `Vendor registered successfully. Business type: ${businessType || 'non-gst'}.`,
            performedBy: {
                name: name,
                role: 'vendor'
            },
            timestamp: new Date()
        }]
    });

    // Send verification OTP via SMS (SMS India Hub)
    await sendOTP(vendor, 'vendor_verification');

    // Notify all active admins asynchronously in the background.
    Admin.find({ isActive: true }).select('_id')
        .then((admins) => {
            Promise.all(
                admins.map((admin) =>
                    createNotification({
                        recipientId: admin._id,
                        recipientType: 'admin',
                        title: 'New Vendor Registration',
                        message: `${vendor.storeName || vendor.name} has registered and is awaiting review.`,
                        type: 'system',
                        data: {
                            vendorId: String(vendor._id),
                            vendorEmail: vendor.email,
                            status: vendor.status,
                        },
                    })
                )
            ).catch(err => console.error('[Vendor Registration Admin Notification Error]:', err));
        })
        .catch(err => console.error('[Vendor Registration Find Admins Error]:', err));

    res.status(201).json(
        new ApiResponse(
            201, 
            { email: vendor.email, phone: vendor.phone }, 
            'Registration submitted. Please verify the OTP sent to your phone number.'
        )
    );
});

// POST /api/vendor/auth/verify-otp
export const verifyOTP = asyncHandler(async (req, res) => {
    const { phone, email, otp } = req.body;
    const normalizedPhone = phone ? String(phone).replace(/\D/g, '').slice(-10) : '';
    const normalizedEmail = email ? String(email).trim().toLowerCase() : '';

    let vendor = null;
    if (normalizedPhone) {
        vendor = await Vendor.findOne({ phone: normalizedPhone }).select('+otp +otpExpiry');
    } else if (normalizedEmail) {
        vendor = await Vendor.findOne({ email: normalizedEmail }).select('+otp +otpExpiry');
    }
    if (!vendor) throw new ApiError(404, 'Vendor not found.');

    const isDev = process.env.NODE_ENV !== 'production';
    const isMasterBypass = isDev && otp === '123456';

    if (!isMasterBypass && vendor.otp !== otp) throw new ApiError(400, 'Invalid OTP.');
    if (!isMasterBypass && vendor.otpExpiry < Date.now()) throw new ApiError(400, 'OTP has expired. Please request a new one.');

    vendor.isVerified = true;
    vendor.otp = undefined;
    vendor.otpExpiry = undefined;
    await vendor.save();

    res.status(200).json(new ApiResponse(200, null, 'Phone verified successfully. Your account is pending admin approval.'));
});

// POST /api/vendor/auth/resend-otp
export const resendOTP = asyncHandler(async (req, res) => {
    const { phone, email } = req.body;
    const normalizedPhone = phone ? String(phone).replace(/\D/g, '').slice(-10) : '';
    const normalizedEmail = email ? String(email).trim().toLowerCase() : '';

    let vendor = null;
    if (normalizedPhone) {
        vendor = await Vendor.findOne({ phone: normalizedPhone });
    } else if (normalizedEmail) {
        vendor = await Vendor.findOne({ email: normalizedEmail });
    }

    if (!vendor) throw new ApiError(404, 'Vendor not found.');
    if (vendor.isVerified) throw new ApiError(400, 'Account is already verified.');

    await sendOTP(vendor, 'vendor_verification');
    res.status(200).json(new ApiResponse(200, null, 'OTP resent successfully to your phone number.'));
});

// POST /api/vendor/auth/forgot-password
export const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    const vendor = await Vendor.findOne({ email: normalizedEmail }).select('+resetOtp +resetOtpExpiry +resetOtpVerified');

    // Keep response generic to avoid account enumeration.
    if (!vendor) {
        return res.status(200).json(
            new ApiResponse(200, null, 'If the email exists, a reset OTP has been sent.')
        );
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    vendor.resetOtp = otp;
    vendor.resetOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    vendor.resetOtpVerified = false;
    await vendor.save({ validateBeforeSave: false });

    try {
        await sendEmail({
            to: vendor.email,
            subject: 'Vendor password reset OTP',
            text: `Your password reset OTP is ${otp}. It expires in 10 minutes.`,
            html: `<p>Your password reset OTP is <strong>${otp}</strong>. It expires in 10 minutes.</p>`,
        });
    } catch (err) {
        console.warn(`[Vendor Forgot Password] Email send failed for ${vendor.email}: ${err.message}`);
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[Vendor Forgot Password] Reset OTP generated for ${vendor.email}`);
        }
    }

    return res.status(200).json(
        new ApiResponse(200, null, 'If the email exists, a reset OTP has been sent.')
    );
});

// POST /api/vendor/auth/verify-reset-otp
export const verifyResetOTP = asyncHandler(async (req, res) => {
    const { email, otp } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    const vendor = await Vendor.findOne({ email: normalizedEmail }).select('+resetOtp +resetOtpExpiry +resetOtpVerified');
    if (!vendor) throw new ApiError(404, 'Vendor not found.');
    if (!vendor.resetOtp || !vendor.resetOtpExpiry) throw new ApiError(400, 'No reset OTP requested.');
    if (vendor.resetOtpExpiry < new Date()) throw new ApiError(400, 'Reset OTP has expired.');
    if (vendor.resetOtp !== String(otp)) throw new ApiError(400, 'Invalid reset OTP.');

    vendor.resetOtpVerified = true;
    await vendor.save({ validateBeforeSave: false });

    return res.status(200).json(new ApiResponse(200, null, 'Reset OTP verified.'));
});

// POST /api/vendor/auth/reset-password
export const resetPassword = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    const vendor = await Vendor.findOne({ email: normalizedEmail }).select('+password +resetOtp +resetOtpExpiry +resetOtpVerified');
    if (!vendor) throw new ApiError(404, 'Vendor not found.');
    if (!vendor.resetOtpVerified) throw new ApiError(400, 'Please verify reset OTP first.');
    if (!vendor.resetOtp || !vendor.resetOtpExpiry) throw new ApiError(400, 'No reset OTP requested.');
    if (vendor.resetOtpExpiry < new Date()) throw new ApiError(400, 'Reset OTP has expired.');

    vendor.password = password;
    vendor.resetOtp = undefined;
    vendor.resetOtpExpiry = undefined;
    vendor.resetOtpVerified = false;
    vendor.refreshTokenHash = undefined;
    vendor.refreshTokenExpiresAt = undefined;
    await vendor.save();

    return res.status(200).json(new ApiResponse(200, null, 'Password reset successful. Please login.'));
});

// POST /api/vendor/auth/send-login-otp
export const sendLoginOTP = asyncHandler(async (req, res) => {
    const { email } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    const vendor = await Vendor.findOne({ email: normalizedEmail });
    if (!vendor) throw new ApiError(404, 'Vendor account not found.');

    await sendOTP(vendor, 'vendor_login');
    res.status(200).json(new ApiResponse(200, null, 'OTP sent successfully. Please check your email.'));
});

// POST /api/vendor/auth/login
export const login = asyncHandler(async (req, res) => {
    const { phone, email, identifier, password, otp } = req.body;
    const rawIdentifier = String(phone || email || identifier || '').trim();

    if (!rawIdentifier) {
        throw new ApiError(400, 'Please provide your phone number or email address.');
    }

    let query = {};
    const digitsOnly = rawIdentifier.replace(/\D/g, '');
    const isPhone = digitsOnly.length >= 10 && !rawIdentifier.includes('@');

    if (isPhone) {
        const normalizedPhone = digitsOnly.slice(-10);
        query = { phone: normalizedPhone };
    } else {
        query = { email: rawIdentifier.toLowerCase() };
    }

    const vendor = await Vendor.findOne(query).select('+password +otp +otpExpiry');
    if (!vendor) throw new ApiError(401, 'Invalid mobile number/email or password.');

    // 1. Password authentication mode (Primary)
    if (password) {
        if (!vendor.password) {
            throw new ApiError(401, 'No password set on this account. Please reset your password or login via OTP.');
        }
        const isMatch = await vendor.comparePassword(password);
        if (!isMatch) throw new ApiError(401, 'Invalid mobile number/email or password.');
    } else if (otp) {
        // 2. OTP fallback authentication mode
        const isDev = process.env.NODE_ENV !== 'production';
        const isMasterBypass = isDev && otp === '123456';
        if (!isMasterBypass && vendor.otp !== otp) throw new ApiError(400, 'Invalid OTP.');
        if (!isMasterBypass && vendor.otpExpiry < Date.now()) throw new ApiError(400, 'OTP has expired.');
    } else {
        throw new ApiError(400, 'Please provide password or OTP to login.');
    }

    if (!vendor.isVerified) {
        await sendOTP(vendor, 'vendor_verification');
        throw new ApiError(403, 'Account not verified. A verification OTP has been sent to your phone number.');
    }

    if (vendor.status !== 'approved') {
        if (vendor.status === 'pending' || vendor.status === 'action_required') {
            // Allow login to access status dashboard
        } else {
            if (vendor.status === 'rejected') {
                throw new ApiError(403, 'Your registration was rejected. Please contact support.');
            }
            if (vendor.status === 'suspended') {
                throw new ApiError(403, `Your account has been suspended. Reason: ${vendor.suspensionReason || 'Contact support.'}`);
            }
            throw new ApiError(403, `Your account status is ${vendor.status}.`);
        }
    }

    vendor.otp = undefined;
    vendor.otpExpiry = undefined;
    await vendor.save();

    const { accessToken, refreshToken } = generateTokens({ id: vendor._id, role: 'vendor', email: vendor.email });
    await persistRefreshSession(vendor, refreshToken);
    res.status(200).json(
        new ApiResponse(
            200, 
            { 
                accessToken, 
                refreshToken, 
                vendor: { 
                    id: vendor._id, 
                    name: vendor.name, 
                    storeName: vendor.storeName, 
                    email: vendor.email, 
                    phone: vendor.phone,
                    storeLogo: vendor.storeLogo 
                } 
            }, 
            'Login successful.'
        )
    );
});

// POST /api/vendor/auth/refresh
export const refresh = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    const decoded = decodeRefreshTokenOrThrow(refreshToken);
    const vendor = await Vendor.findById(decoded.id).select('+refreshTokenHash +refreshTokenExpiresAt status isVerified suspensionReason');

    if (!vendor) throw new ApiError(401, 'Invalid refresh token.');
    if (!vendor.isVerified) throw new ApiError(403, 'Please verify your email first.');
    if (vendor.status !== 'approved') {
        if (vendor.status === 'pending' || vendor.status === 'action_required') {
            // Allow refresh
        } else {
            if (vendor.status === 'rejected') {
                throw new ApiError(403, 'Your registration was rejected. Please contact support.');
            }
            if (vendor.status === 'suspended') {
                throw new ApiError(403, `Your account has been suspended. Reason: ${vendor.suspensionReason || 'Contact support.'}`);
            }
            throw new ApiError(403, `Your account status is ${vendor.status}.`);
        }
    }

    const tokens = await rotateRefreshSession(
        vendor,
        { id: vendor._id, role: 'vendor', email: vendor.email },
        refreshToken
    );

    return res.status(200).json(new ApiResponse(200, tokens, 'Session refreshed successfully.'));
});

// POST /api/vendor/auth/logout
export const logout = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    if (refreshToken) {
        try {
            const decoded = decodeRefreshTokenOrThrow(refreshToken);
            const vendor = await Vendor.findById(decoded.id).select('+refreshTokenHash +refreshTokenExpiresAt');
            if (vendor?.refreshTokenHash) {
                await clearRefreshSession(vendor);
            }
        } catch {
            // Keep logout idempotent.
        }
    }

    return res.status(200).json(new ApiResponse(200, null, 'Logged out successfully.'));
});

// GET /api/vendor/auth/profile
export const getProfile = asyncHandler(async (req, res) => {
    const vendor = await Vendor.findById(req.user.id).select('-password -otp -otpExpiry').populate('categories', 'name slug');
    if (!vendor) throw new ApiError(404, 'Vendor not found.');
    res.status(200).json(new ApiResponse(200, vendor, 'Profile fetched.'));
});

// PUT /api/vendor/auth/profile
export const updateProfile = asyncHandler(async (req, res) => {
    const allowed = [
        'name',
        'phone',
        'storeName',
        'storeDescription',
        'storeLogo',
        'address',
        'shippingEnabled',
        'freeShippingThreshold',
        'defaultShippingRate',
        'shippingMethods',
        'handlingTime',
        'processingTime',
        'businessType',
        'legalBusinessName',
        'gstin',
        'panNumber',
        'gstCertificate',
        'panCardDocument',
        'businessAddress',
        'fssaiLicenseNumber',
        'fssaiLicenseDocument',
    ];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
    
    const currentVendor = await Vendor.findById(req.user.id);
    if (!currentVendor) throw new ApiError(404, 'Vendor not found.');

    const verificationFields = [
        'businessType',
        'legalBusinessName',
        'gstin',
        'panNumber',
        'gstCertificate',
        'panCardDocument',
        'businessAddress',
        'fssaiLicenseNumber',
        'fssaiLicenseDocument',
    ];

    let requiresReverification = false;
    let detailsStr = '';

    for (const field of verificationFields) {
        if (updates[field] !== undefined) {
            const val1 = JSON.stringify(currentVendor[field]);
            const val2 = JSON.stringify(updates[field]);
            if (val1 !== val2) {
                requiresReverification = true;
                detailsStr += `${field} modified. `;
            }
        }
    }

    if (requiresReverification) {
        if (['approved', 'action_required', 'rejected'].includes(currentVendor.status)) {
            updates.status = 'pending';
            updates.$push = {
                verificationTimeline: {
                    status: 'pending',
                    remarks: `Business verification details modified. Re-verification required. Details: ${detailsStr}`,
                    updatedByName: 'System',
                    updatedAt: new Date()
                },
                verificationAuditLog: {
                    action: 'profile_edit_reverification',
                    details: `Vendor updated verification details: ${detailsStr}. Status reset to pending.`,
                    performedBy: {
                        id: currentVendor._id,
                        name: currentVendor.name,
                        role: 'vendor'
                    },
                    timestamp: new Date()
                }
            };
        } else {
            updates.$push = {
                verificationAuditLog: {
                    action: 'profile_edit',
                    details: `Vendor updated verification details: ${detailsStr}`,
                    performedBy: {
                        id: currentVendor._id,
                        name: currentVendor.name,
                        role: 'vendor'
                    },
                    timestamp: new Date()
                }
            };
        }
    }

    const vendor = await Vendor.findByIdAndUpdate(req.user.id, updates, { new: true, runValidators: true }).select('-password -otp -otpExpiry').populate('categories', 'name slug');
    res.status(200).json(new ApiResponse(200, vendor, 'Profile updated.'));
});

// PUT /api/vendor/auth/bank-details
export const updateBankDetails = asyncHandler(async (req, res) => {
    const { accountName, accountNumber, bankName, ifscCode } = req.body;
    if (!accountName && !accountNumber && !bankName && !ifscCode) {
        throw new ApiError(400, 'At least one bank detail field is required.');
    }

    const updates = {};
    if (accountName) updates['bankDetails.accountName'] = accountName;
    if (accountNumber) updates['bankDetails.accountNumber'] = accountNumber;
    if (bankName) updates['bankDetails.bankName'] = bankName;
    if (ifscCode) updates['bankDetails.ifscCode'] = ifscCode;

    const vendor = await Vendor.findByIdAndUpdate(
        req.user.id,
        { $set: updates },
        { new: true, runValidators: true }
    ).select('-password -otp -otpExpiry');

    res.status(200).json(new ApiResponse(200, vendor, 'Bank details updated.'));
});
