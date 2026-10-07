import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  FiFacebook,
  FiInstagram,
  FiTwitter,
  FiLinkedin,
  FiMail,
  FiPhone,
  FiMapPin,
  FiClock,
} from "react-icons/fi";
import { useSettingsStore } from "../../../../shared/store/settingsStore";

const SOCIAL_ICONS = {
  facebook: { icon: FiFacebook, label: "Facebook" },
  instagram: { icon: FiInstagram, label: "Instagram" },
  twitter: { icon: FiTwitter, label: "Twitter" },
  linkedin: { icon: FiLinkedin, label: "LinkedIn" },
};

const MAIN_LINKS = [
  { to: "/home", label: "Home" },
  { to: "/stores", label: "Stores" },
  { to: "/search", label: "Shop" },
  { to: "/orders", label: "My Orders" },
  { to: "/support", label: "Support" },
];

const LEGAL_LINKS = [{ to: "/privacy-policy", label: "Privacy Policy" }];

// Desktop-only site footer; hidden below the md breakpoint (mobile uses the bottom nav).
const Footer = () => {
  const settings = useSettingsStore((state) => state.settings);
  const initialize = useSettingsStore((state) => state.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  const general = settings?.general || {};
  const brandName = general.storeName || "KuroAgro";
  const socialLinks = Object.entries(general.socialMedia || {}).filter(
    ([platform, href]) => SOCIAL_ICONS[platform] && String(href || "").trim()
  );
  const contactItems = [
    { icon: FiMail, value: general.contactEmail, href: `mailto:${general.contactEmail}` },
    { icon: FiPhone, value: general.contactPhone, href: `tel:${general.contactPhone}` },
    { icon: FiMapPin, value: general.address },
    { icon: FiClock, value: general.businessHours },
  ].filter((item) => String(item.value || "").trim());

  return (
    <footer className="hidden md:block bg-white border-t border-gray-200 pb-8 pt-6 lg:pt-8">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="md:flex md:items-start md:justify-between">
          <div className="max-w-md">
            <Link to="/" className="flex items-center gap-x-2" aria-label={brandName}>
              {general.storeLogo && (
                <img src={general.storeLogo} alt="" className="h-10 w-10 object-contain" />
              )}
              <span className="font-bold text-xl text-gray-900">{brandName}</span>
            </Link>
            {general.storeDescription && (
              <p className="mt-4 text-sm leading-6 text-gray-600">{general.storeDescription}</p>
            )}
          </div>

          {socialLinks.length > 0 && (
            <ul className="flex list-none space-x-3">
              {socialLinks.map(([platform, href]) => {
                const { icon: Icon, label } = SOCIAL_ICONS[platform];
                return (
                  <li key={platform}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={label}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700 transition-colors hover:bg-primary-600 hover:text-white"
                    >
                      <Icon className="h-5 w-5" />
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-gray-200 mt-8 pt-8 lg:grid lg:grid-cols-10">
          <div className="text-sm leading-6 text-gray-600 lg:col-[1/4]">
            <div>
              © {new Date().getFullYear()} {brandName}
            </div>
            <div>All rights reserved</div>
          </div>

          <div className="mt-6 lg:mt-0 lg:col-[4/11]">
            <nav>
              <ul className="list-none flex flex-wrap -my-1 -mx-2 lg:justify-end">
                {MAIN_LINKS.map((link) => (
                  <li key={link.to} className="my-1 mx-2 shrink-0">
                    <Link
                      to={link.to}
                      className="text-sm text-primary-700 underline-offset-4 hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {contactItems.length > 0 && (
              <ul className="list-none mt-5 flex flex-wrap gap-x-6 gap-y-2 lg:justify-end">
                {contactItems.map(({ icon: Icon, value, href }) => (
                  <li key={value} className="flex items-center gap-2 text-sm text-gray-600">
                    <Icon className="h-4 w-4 shrink-0 text-primary-600" />
                    {href ? (
                      <a href={href} className="hover:underline underline-offset-4">
                        {value}
                      </a>
                    ) : (
                      <span>{value}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <ul className="list-none mt-5 flex flex-wrap -my-1 -mx-3 lg:justify-end">
              {LEGAL_LINKS.map((link) => (
                <li key={link.to} className="my-1 mx-3 shrink-0">
                  <Link
                    to={link.to}
                    className="text-sm text-gray-500 underline-offset-4 hover:underline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
