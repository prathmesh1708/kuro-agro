import { motion } from "framer-motion";
import { FiHelpCircle, FiArrowLeft, FiMail, FiPhone, FiMessageSquare } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

const StaticSupport = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-55 via-gray-100 to-white text-gray-800 py-12 px-4 sm:px-6 lg:px-8">
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
            <FiHelpCircle className="w-10 h-10 text-primary-600" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700">
            Support Desk
          </h1>
          <p className="mt-3 text-lg text-gray-600 max-w-2xl mx-auto">
            Have questions or need assistance? We're here to help you 24/7.
          </p>
        </motion.div>

        {/* Support Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12"
        >
          {/* Card 1: Email */}
          <div className="bg-white/80 backdrop-blur-md border border-gray-200 rounded-2xl p-6 text-center hover:border-primary-500/50 hover:shadow-sm transition-all duration-300">
            <div className="inline-flex items-center justify-center p-3 bg-blue-50 text-blue-600 rounded-xl mb-4">
              <FiMail className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Email Support</h3>
            <p className="text-gray-500 text-sm mb-4">Drop us an email anytime and we will respond within 24 hours.</p>
            <a href="mailto:rathiparivaar@gmail.com" className="text-primary-600 hover:text-primary-500 text-sm font-semibold transition-colors duration-200">
              rathiparivaar@gmail.com
            </a>
          </div>

          {/* Card 2: Phone */}
          <div className="bg-white/80 backdrop-blur-md border border-gray-200 rounded-2xl p-6 text-center hover:border-primary-500/50 hover:shadow-sm transition-all duration-300">
            <div className="inline-flex items-center justify-center p-3 bg-green-50 text-green-600 rounded-xl mb-4">
              <FiPhone className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Call Us</h3>
            <p className="text-gray-500 text-sm mb-4">Reach out to our customer care executive directly.</p>
            <a href="tel:+919828032431" className="text-primary-600 hover:text-primary-500 text-sm font-semibold transition-colors duration-200">
              +91 9828032431
            </a>
          </div>

          {/* Card 3: Live Chat */}
          <div className="bg-white/80 backdrop-blur-md border border-gray-200 rounded-2xl p-6 text-center hover:border-primary-500/50 hover:shadow-sm transition-all duration-300">
            <div className="inline-flex items-center justify-center p-3 bg-purple-50 text-purple-600 rounded-xl mb-4">
              <FiMessageSquare className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Quick FAQ</h3>
            <p className="text-gray-500 text-sm mb-4">Frequently asked questions and guides for instant resolution.</p>
            <span className="text-primary-600 text-sm font-semibold">
              Available in app
            </span>
          </div>
        </motion.div>

        {/* FAQs Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/80 backdrop-blur-md border border-gray-200 rounded-2xl p-6 sm:p-10 shadow-sm"
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <div className="border-b border-gray-200 pb-4">
              <h4 className="text-lg font-semibold text-gray-900 mb-2">How can I track my order?</h4>
              <p className="text-gray-600 text-sm">
                You can track your order using the order ID sent to you via SMS/Email or via the tracking link provided on the homepage.
              </p>
            </div>
            <div className="border-b border-gray-200 pb-4">
              <h4 className="text-lg font-semibold text-gray-900 mb-2">What is the return policy?</h4>
              <p className="text-gray-600 text-sm">
                We accept returns within 7 days of delivery. Make sure the items are unused, in their original packaging, with tags intact.
              </p>
            </div>
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">How do I register as a vendor?</h4>
              <p className="text-gray-600 text-sm">
                Navigate to the vendor portal and click on 'Register' to submit your business details for verification.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default StaticSupport;
