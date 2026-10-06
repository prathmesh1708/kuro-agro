import { motion } from "framer-motion";
import { FiShield, FiArrowLeft, FiClock } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

const StaticPrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-white text-gray-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-8 transition-colors duration-200"
        >
          <FiArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center p-3 bg-primary-50 rounded-2xl mb-4 border border-primary-100">
            <FiShield className="w-10 h-10 text-primary-600" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700">
            Privacy Policy
          </h1>
          <p className="mt-3 text-lg text-gray-600 max-w-2xl mx-auto">
            Your privacy is important to us. Learn how we collect, use, and safeguard your data.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
            <FiClock />
            <span>Last Updated: July 2026</span>
          </div>
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/80 backdrop-blur-md border border-gray-200/80 rounded-2xl p-6 sm:p-10 space-y-8 shadow-sm"
        >
          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-50 text-primary-600 font-semibold border border-primary-100">
                1
              </span>
              <h2 className="text-xl font-bold text-gray-900">Information We Collect</h2>
            </div>
            <p className="text-gray-650 leading-relaxed pl-11">
              We collect information you provide directly to us when creating accounts, updating profiles, placing orders, or contacting support. This may include your name, email address, phone number, address, and payment information.
            </p>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-50 text-primary-600 font-semibold border border-primary-100">
                2
              </span>
              <h2 className="text-xl font-bold text-gray-900">How We Use Your Information</h2>
            </div>
            <p className="text-gray-650 leading-relaxed pl-11">
              We use the collected information to process transactions, maintain and improve our services, communicate promotional offers, prevent fraud, and provide support services to you.
            </p>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-50 text-primary-600 font-semibold border border-primary-100">
                3
              </span>
              <h2 className="text-xl font-bold text-gray-900">Data Security & Storage</h2>
            </div>
            <p className="text-gray-650 leading-relaxed pl-11">
              We implement industry-standard encryption and security measures to protect your personal data from unauthorized access, alteration, disclosure, or destruction.
            </p>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-50 text-primary-600 font-semibold border border-primary-100">
                4
              </span>
              <h2 className="text-xl font-bold text-gray-900">Cookies & Tracking</h2>
            </div>
            <p className="text-gray-650 leading-relaxed pl-11">
              We use cookies to enhance your experience, analyze site usage, and personalize content. You can manage your cookie preferences through your browser settings.
            </p>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-50 text-primary-600 font-semibold border border-primary-100">
                5
              </span>
              <h2 className="text-xl font-bold text-gray-900">Your Rights & Choices</h2>
            </div>
            <p className="text-gray-650 leading-relaxed pl-11">
              You have the right to access, correct, update, or request deletion of your personal information at any time. Please contact our support team to exercise these rights.
            </p>
          </section>
        </motion.div>
      </div>
    </div>
  );
};

export default StaticPrivacyPolicy;
