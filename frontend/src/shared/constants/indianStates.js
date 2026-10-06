/**
 * indianStates.js
 * Comprehensive list of Indian States & Union Territories for standard form dropdowns.
 */

export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry"
];

export const STATE_CODE_MAP = {
  "ap": "Andhra Pradesh",
  "ar": "Arunachal Pradesh",
  "as": "Assam",
  "br": "Bihar",
  "cg": "Chhattisgarh",
  "ct": "Chhattisgarh",
  "ga": "Goa",
  "gj": "Gujarat",
  "hr": "Haryana",
  "hp": "Himachal Pradesh",
  "jh": "Jharkhand",
  "ka": "Karnataka",
  "kl": "Kerala",
  "mp": "Madhya Pradesh",
  "mh": "Maharashtra",
  "mn": "Manipur",
  "ml": "Meghalaya",
  "mz": "Mizoram",
  "nl": "Nagaland",
  "or": "Odisha",
  "od": "Odisha",
  "pb": "Punjab",
  "rj": "Rajasthan",
  "sk": "Sikkim",
  "tn": "Tamil Nadu",
  "ts": "Telangana",
  "tg": "Telangana",
  "tr": "Tripura",
  "up": "Uttar Pradesh",
  "uk": "Uttarakhand",
  "ut": "Uttarakhand",
  "wb": "West Bengal",
  "dl": "Delhi",
  "jk": "Jammu and Kashmir",
  "la": "Ladakh",
  "py": "Puducherry",
  "ch": "Chandigarh"
};

export const normalizeIndianState = (stateInput = "") => {
  if (!stateInput) return "Madhya Pradesh";
  const trimmed = stateInput.trim();
  const lower = trimmed.toLowerCase();
  
  if (STATE_CODE_MAP[lower]) {
    return STATE_CODE_MAP[lower];
  }
  
  const found = INDIAN_STATES.find(
    (s) => s.toLowerCase() === lower || s.toLowerCase().includes(lower)
  );
  return found || trimmed;
};
