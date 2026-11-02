/**
 * Centralized legal policies and terms for the KuroAgro ecosystem.
 * Tailored for multi-role workflows: Delivery Partners, Customers, Kisans (Farmers),
 * Vendors (Sellers), Field Network (Sanchalaks & Surveyors), and Platform Governance.
 * Compliant with the Digital Personal Data Protection Act, 2023 (DPDP Act) and Indian E-Commerce Rules.
 */

export const LAST_UPDATED_DATE = "October 2026";

export const SUPPORT_CONTACT = {
  companyName: "KuroAgro Agri-Solutions",
  supportEmail: "support@kuroagro.com",
  supportPhone: "+91 98765 43210",
  hours: "Mon-Sat 8:00 AM - 8:00 PM IST",
  address: "KuroAgro Hub, Agricultural Trade Center, India",
  grievanceOfficer: {
    name: "Grievance Redressal Officer",
    email: "grievance@kuroagro.com",
    designation: "Nodal & Grievance Officer, KuroAgro",
  },
};

export const ROLE_TABS = [
  { id: "all", label: "All Roles / Overview" },
  { id: "customer", label: "Customer / Buyer" },
  { id: "delivery", label: "Delivery Partner" },
  { id: "kisan", label: "Farmer / Kisan" },
  { id: "vendor", label: "Vendor / Seller" },
  { id: "fieldNetwork", label: "Field Network" },
];

export const PRIVACY_POLICY_SECTIONS = [
  {
    id: "scope",
    roles: ["all", "customer", "delivery", "kisan", "vendor", "fieldNetwork"],
    badge: "01",
    title: "Scope & What This Policy Covers",
    body: [
      "This Privacy Policy explains how KuroAgro Agri-Solutions ('KuroAgro', 'we', 'our', or 'us') collects, uses, stores, and protects personal information when you access or use the KuroAgro web platform, mobile applications, or role-based interfaces.",
      "KuroAgro operates a unified agricultural commerce and field network platform serving Customers (buyers of produce and agricultural inputs), Delivery Partners (logistics personnel), Kisans (farmers participating in produce procurement and seed programs), Vendors (dealers, manufacturers, and sellers), and Field Executives (Sanchalaks and Surveyors).",
      "This policy is formulated in strict accordance with the Digital Personal Data Protection Act, 2023 (DPDP Act), the Information Technology Act, 2000, and related Indian data protection regulations.",
    ],
  },
  {
    id: "info-collected",
    roles: ["all", "customer", "delivery", "kisan", "vendor", "fieldNetwork"],
    badge: "02",
    title: "Information We Collect Across Roles",
    body: [
      "Customers: Name, mobile number (used for secure OTP authentication), delivery addresses, email address, order details, payment method choice, and communication preferences.",
      "Delivery Partners: Full legal name, mobile number, city, vehicle details (type and registration number), driving license details, government ID proofs (Aadhaar / Driving License), payout details (bank account number, IFSC code, or UPI ID), work logs (orders accepted, delivered, cash collected), and notification device tokens.",
      "Farmers / Kisans: Farmer name, mobile number, landholding documents, village/panchayat/district location, crop survey details, Kisan ID code, seed allocations, and bank accounts for direct harvest payouts.",
      "Vendors / Sellers: Business registration details, GSTIN, PAN, registered business address, warehouse pickup locations, merchant bank account details, catalog data, and brand authorizations.",
      "Field Network (Sanchalaks & Surveyors): Full name, assigned Kendra/hub details, verification photos, surveyor ID code, seed inventory custody records, and commission payout details.",
      "Device & Usage Data: IP address, device model, operating system, push notification tokens, and application crash diagnostics. We do not engage in covert live background tracking; map directions are processed via your device's native navigation app.",
    ],
  },
  {
    id: "how-we-use",
    roles: ["all", "customer", "delivery", "kisan", "vendor", "fieldNetwork"],
    badge: "03",
    title: "How We Use Your Information",
    body: [
      "To verify identity, approve role registrations, and authenticate users via secure OTP login.",
      "To process transactions, generate invoices, allocate deliveries, and fulfill orders.",
      "To verify delivery completion via the mandatory 4-digit customer delivery code.",
      "To calculate and disburse Delivery Partner earnings, vendor settlements, farmer produce payments, and field network commissions.",
      "To reconcile Cash on Delivery (COD) collections, maintain transparent wallet ledgers, and prevent fraud or financial discrepancies.",
      "To communicate important order updates, seed distribution alerts, and service announcements via SMS, WhatsApp, and push notifications.",
      "To comply with legal, tax, agricultural certification, and regulatory obligations under Indian law.",
    ],
  },
  {
    id: "sharing",
    roles: ["all", "customer", "delivery", "vendor"],
    badge: "04",
    title: "Information Sharing & Third-Party Disclosures",
    body: [
      "Between Transaction Participants: Delivery partners see customer name, delivery address, and phone number only for active assigned orders. Customers see delivery partner name, vehicle type, and phone number once an order is out for delivery. Customers never see partner bank details or identity documents.",
      "Service Providers: We engage trusted service providers for cloud hosting, SMS/OTP gateways, push notification delivery (Firebase), and secure digital payments (PCI-DSS compliant gateways like Razorpay). These providers process data strictly on our instructions.",
      "No Sale of Data: KuroAgro does not sell, rent, or trade your personal data to any third party for commercial or advertising purposes.",
      "Legal Compliance: We may disclose information if required by a valid court order, law enforcement inquiry, or statutory authority under Indian law.",
    ],
  },
  {
    id: "delivery-partner-privacy",
    roles: ["delivery"],
    badge: "05",
    title: "Delivery Partner Specific Privacy Safeguards",
    body: [
      "Verification Documents: Driving license, Aadhaar photos, and vehicle registration are stored securely with encrypted access restricted solely to authorized admin verification officers.",
      "Payout Information: Bank account numbers and UPI IDs are utilized exclusively for processing wallet withdrawal payouts and recovering unsettled cash collections.",
      "Location Transparency: KuroAgro does not track your real-time 24/7 background location. Navigation directions open within your chosen maps application (e.g., Google Maps), operating under its own privacy policy.",
      "Work Records: Shift timings, order completions, cancellation counts, and customer feedback are logged to determine incentive eligibility and maintain account standing.",
    ],
  },
  {
    id: "kisan-vendor-privacy",
    roles: ["kisan", "vendor"],
    badge: "06",
    title: "Kisan & Vendor Data Integrity",
    body: [
      "Kisan Records: Landholding records, crop details, and seed distribution ledgers are retained for agricultural program administration, quality assurance, and direct benefit remittances.",
      "Vendor Business Data: Invoices, GSTIN records, and product certifications are maintained to ensure consumer protection and statutory tax compliance under Indian GST laws.",
    ],
  },
  {
    id: "security",
    roles: ["all", "customer", "delivery", "kisan", "vendor", "fieldNetwork"],
    badge: "07",
    title: "Data Security & Storage",
    body: [
      "All data in transit is encrypted using industry-standard TLS/HTTPS protocols. Sensitive fields such as tokens, bank credentials, and passwords are protected with strong hashing algorithms.",
      "Access to internal databases is restricted on a least-privilege role basis and monitored with automated audit trails.",
      "Users are advised to keep their devices secure, never share OTP codes or login credentials with anyone, and report any unauthorized access immediately.",
    ],
  },
  {
    id: "rights-dpdp",
    roles: ["all", "customer", "delivery", "kisan", "vendor", "fieldNetwork"],
    badge: "08",
    title: "Your Rights under DPDP Act, 2023",
    body: [
      "Right to Access: You may view your profile, contact details, order history, and payout ledger anytime through the KuroAgro mobile app or web portal.",
      "Right to Correction: You may request the update or correction of incomplete or outdated personal information via your profile or customer/partner support.",
      "Right to Erasure: You may request account closure and deletion of data that is no longer required for active operations or legal/tax compliance.",
      "Right to Grievance Redressal: If you have concerns regarding the processing of your personal data, you may lodge a complaint with our Grievance Officer.",
    ],
  },
  {
    id: "retention-contact",
    roles: ["all", "customer", "delivery", "kisan", "vendor", "fieldNetwork"],
    badge: "09",
    title: "Data Retention & Grievance Contact",
    body: [
      "We retain your data for the duration of your active account. Financial, tax, invoice, and trade transaction records are retained for the statutory period required by Indian law (typically 7–8 years).",
      "For privacy questions, data requests, or complaints, contact our Grievance Officer at grievance@kuroagro.com or write to KuroAgro Agri-Solutions Support at support@kuroagro.com.",
    ],
  },
];

export const TERMS_CONDITIONS_SECTIONS = [
  {
    id: "acceptance",
    roles: ["all", "customer", "delivery", "kisan", "vendor", "fieldNetwork"],
    badge: "01",
    title: "Acceptance of Terms & General Rules",
    body: [
      "These Terms & Conditions ('Terms') constitute a legally binding agreement between you and KuroAgro Agri-Solutions ('KuroAgro') governing your use of our website, mobile applications, and services.",
      "By signing up, creating an account, or transacting on KuroAgro in any role (Customer, Delivery Partner, Kisan, Vendor, or Field Executive), you confirm that you are at least 18 years of age and accept these Terms in full.",
      "KuroAgro reserves the right to modify these Terms. Continued use of the platform following any update indicates your agreement to the revised terms.",
    ],
  },
  {
    id: "customer-terms",
    roles: ["customer", "all"],
    badge: "02",
    title: "Customer Terms: Ordering, Pricing & Deliveries",
    body: [
      "Account & Accuracy: Customers agree to provide accurate delivery addresses, contact numbers, and recipient details. You are responsible for all activities under your account.",
      "Pricing & Quality: All product prices are quoted in Indian Rupees (INR) including applicable taxes unless stated otherwise. Agro-inputs, seeds, and fresh produce are supplied in accordance with standard agricultural quality norms.",
      "Delivery Verification Code (OTP): For security and dispute prevention, KuroAgro issues a unique 4-digit Delivery Verification Code for every delivery. You must inspect the package seal and share this 4-digit code with the delivery partner ONLY upon receiving your order.",
      "Cash on Delivery (COD): COD is an elective convenience service. For COD orders, you must tender the exact payable amount in cash or scan the dynamic UPI QR code presented by the KuroAgro delivery partner. Misuse or repeated unprompted refusal of COD orders may lead to suspension of COD eligibility.",
      "Cancellations & Returns: Orders may be cancelled before dispatch. Damaged, defective, or mispackaged agro-inputs may be returned within the designated return window subject to inspection.",
    ],
  },
  {
    id: "delivery-partner-status",
    roles: ["delivery", "all"],
    badge: "03",
    title: "Delivery Partner: Independent Contractor Status",
    body: [
      "These terms apply when you use the KuroAgro Delivery Partner app or portal to pick up orders from stores, warehouses, or Kendras and deliver them to customers.",
      "Independent Contractor: You work as an independent logistics contractor, not as an employee of KuroAgro or of any store or hub. You have full discretion over when to go online, take breaks, and accept assignments.",
      "Eligibility: You must be at least 18 years of age, hold a valid driving license for your vehicle (not mandatory for bicycles), and ensure your vehicle is roadworthy, registered (RC), and insured as mandated by Indian motor vehicle laws.",
      "KYC & Verification: You must submit your name, phone number, vehicle details, driving license, and Aadhaar proof during signup. KuroAgro reserves the right to approve, reject, or re-verify partner documentation at any time.",
    ],
  },
  {
    id: "delivery-orders-execution",
    roles: ["delivery"],
    badge: "04",
    title: "Delivery Partner: Order Acceptance & Execution",
    body: [
      "Accepting Orders: Online approved partners in active operational zones receive available delivery requests. Once you accept an order, you are committed to completing the delivery promptly.",
      "Order Limits: You may carry up to the maximum number of concurrent orders configured by KuroAgro for your vehicle class.",
      "Automated Assignment: If an order remains unassigned, the platform may assign it to an available online partner with an audio alert. Rejecting an automated assignment does not penalize your account.",
      "Store Pickup & Inspection: At the store or Kendra, inspect packaging integrity and item count before confirming pickup. Handle all goods (including fragile farm produce and sealed seeds) with utmost care.",
      "Tamper-Free Transport: Opening, consuming, or tampering with customer packages is strictly prohibited and constitutes grounds for immediate termination and legal action.",
      "Mandatory 4-Digit Code: Complete a delivery in the app ONLY after the customer gives you the 4-digit verification code from their app. Never complete an order without the code, and never demand the code prior to physical handover.",
    ],
  },
  {
    id: "delivery-undelivered",
    roles: ["delivery"],
    badge: "05",
    title: "Delivery Partner: Undeliverable Orders & Returns",
    body: [
      "Customer Unavailability: If a customer refuses an order, cannot be reached after multiple attempts, or the address is unsafe/incorrect, use the in-app 'Contact Support' button immediately.",
      "Return Protocols: Support will advise whether to hold or return the consignment back to the merchant/Kendra on the same day. Do not abandon, keep, or sell undeliverable goods.",
      "Strict Recovery: Keeping, selling, or damaging customer orders without authorization will result in full financial recovery from your earnings wallet and immediate account blocking.",
    ],
  },
  {
    id: "delivery-cod-handling",
    roles: ["delivery"],
    badge: "06",
    title: "Delivery Partner: Cash on Delivery (COD) Rules",
    body: [
      "Exact Collection: For COD orders, collect the exact invoice amount shown in the app—either in physical cash or by having the customer scan the dynamic in-app UPI QR code. Never quote unauthorized surcharges or give discounts.",
      "No Personal UPI: Directing customers to pay into your personal UPI ID, personal Google Pay/PhonePe, or non-KuroAgro bank accounts is strictly prohibited.",
      "Cash in Hand Custody: All physical cash collected belongs to KuroAgro and the fulfilling merchant. The app tracks this as 'Cash in Hand'. You must remit/settle cash according to the platform schedule.",
      "Recovery: Unsettled cash balances exceeding the permitted ceiling will be automatically deducted from your earned delivery payouts or lead to dispatch restrictions.",
    ],
  },
  {
    id: "delivery-earnings-payouts",
    roles: ["delivery"],
    badge: "07",
    title: "Delivery Partner: Earnings, Targets & Payouts",
    body: [
      "Per-Delivery Payouts: You earn standard delivery fees per completed order based on distance, order volume, and active rate cards shown in your Wallet tab.",
      "Withdrawal Schedule: You may request wallet withdrawals to your linked bank account or UPI ID in accordance with the payout schedule (daily or weekly cycles) above the minimum threshold.",
      "Targets & Incentives: KuroAgro may offer shift-based or milestone incentives. Target bonuses require maintaining required login hours and keeping order cancellations below the threshold.",
      "Partner Costs: As an independent partner, you are responsible for your own fuel, smartphone data, vehicle maintenance, and personal tax obligations.",
    ],
  },
  {
    id: "delivery-safety-conduct",
    roles: ["delivery"],
    badge: "08",
    title: "Delivery Partner: Safety, Conduct & Account Standing",
    body: [
      "Road Safety: Always obey traffic signals, observe speed limits, and wear an approved safety helmet or seatbelt. Never operate the application while riding or driving.",
      "Professional Conduct: Treat customers, storekeepers, and Kendra staff with courtesy and respect. Never engage in abusive language, discrimination, or physical altercations.",
      "Confidentiality: Customer phone numbers and addresses must be used exclusively to complete deliveries. Retaining, recording, or contacting customers post-delivery is illegal.",
      "Suspension: KuroAgro reserves the right to suspend or terminate accounts for fraud, customer harassment, excessive unexcused cancellations, or mishandling of COD funds.",
    ],
  },
  {
    id: "kisan-terms",
    roles: ["kisan", "all"],
    badge: "09",
    title: "Kisan (Farmer) Produce Procurement & Seed Distribution",
    body: [
      "Fair Procurement: Kisans registered on KuroAgro can submit Produce Sale Requests to sell agricultural yields directly to KuroAgro Kendras.",
      "Quality & Weighment: All produce delivered is subjected to transparent weighing and grade inspection. Payouts are computed strictly on confirmed quality and accepted weight.",
      "Direct Remittance: Sale proceeds are disbursed directly to the farmer's registered bank account or verified mobile wallet.",
      "Seed Programs: Certified seeds and inputs provided under KuroAgro schemes must be utilized solely for agricultural cultivation in according with program guidelines.",
    ],
  },
  {
    id: "vendor-terms",
    roles: ["vendor", "all"],
    badge: "10",
    title: "Vendor ('Sell on KuroAgro') Obligations",
    body: [
      "Genuine Products: Vendors must warrant that all seeds, agro-chemicals, fertilizers, and equipment listed are 100% genuine, properly labeled, and compliant with the Seeds Act, 1966 and Insecticides Act, 1968.",
      "Expiry & Packaging: Selling expired, misbranded, or counterfeit goods is grounds for immediate termination, forfeiture of payouts, and legal prosecution.",
      "Order Fulfillment: Vendors must pack orders securely in tamper-evident packaging and mark them ready for pickup within the agreed service level agreement (SLA).",
      "GST & Taxation: Vendors are solely responsible for remitting GST collected from sales to the government and issuing valid tax invoices.",
    ],
  },
  {
    id: "field-network-terms",
    roles: ["fieldNetwork", "all"],
    badge: "11",
    title: "Field Network: Sanchalaks & Surveyors",
    body: [
      "Kendra Custody: Sanchalaks are responsible for maintaining safe, dry, and secure storage for seed stocks, procured produce, and company equipment entrusted to their Kendra.",
      "Farmer Surveys: Surveyors must verify farmer land records, crop surveys, and identity proofs with complete diligence. Fabricating farmer profiles or survey data is strictly prohibited.",
      "Commission Settlement: Commissions are earned upon admin approval of verified registrations and completed seed issues.",
    ],
  },
  {
    id: "liability-governing",
    roles: ["all", "customer", "delivery", "kisan", "vendor", "fieldNetwork"],
    badge: "12",
    title: "Limitation of Liability & Governing Law",
    body: [
      "Platform As-Is: KuroAgro provides its digital marketplace and logistics matching software on an 'as is' basis without warranty of uninterrupted service.",
      "Third-Party Acts: To the maximum extent permitted by Indian law, KuroAgro is not liable for indirect, incidental, or road traffic damages occurring during partner transit.",
      "Dispute Resolution & Jurisdiction: These Terms are governed by and construed in accordance with the laws of India. Courts at the registered seat of KuroAgro shall have exclusive jurisdiction over any disputes.",
    ],
  },
];

