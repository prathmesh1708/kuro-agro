// Options and agreement text for the Kuro Rice farmer registration form.
// Values must match the backend enums in FarmerRegistration.model.js.

export const LAND_TYPE_OPTIONS = [
  { value: 'own', label: 'Own / स्वयं की' },
  { value: 'lease', label: 'Lease / पट्टे' },
];

export const IRRIGATION_OPTIONS = [
  { value: 'canal', label: 'Canal / नहर' },
  { value: 'bore', label: 'Bore / बोर' },
  { value: 'pond', label: 'Pond / तालाब' },
  { value: 'rain', label: 'Rain Based / वर्षा आधारित' },
];

export const FARMING_METHOD_OPTIONS = [{ value: 'natural', label: 'Natural Farming / प्राकृतिक खेती' }];

export const optionLabel = (options, value) => options.find((o) => o.value === value)?.label || value || '—';

export const REGISTRATION_STATUS_META = {
  submitted: { label: 'Pending Verification', className: 'bg-yellow-50 text-yellow-800 border-yellow-200' },
  approved: { label: 'Approved', className: 'bg-green-50 text-green-700 border-green-200' },
  rejected: { label: 'Rejected', className: 'bg-red-50 text-red-700 border-red-200' },
};

export const AGREEMENT_SECTIONS = [
  {
    title: 'Part 3: Seed & Farming / भाग – 3 : बीज एवं खेती',
    points: [
      'The farmer shall mandatorily purchase seeds and fertilizers only from the company at company-determined rates. The seed requirement shall be 20 kg per acre. / किसान को बीज एवं खाद केवल कंपनी से ही, कंपनी द्वारा निर्धारित दरों पर खरीदना अनिवार्य होगा। प्रति एकड़ 20 किलोग्राम बीज की आवश्यकता होगी।',
      'Farming will be done using natural methods (no chemicals) or as per company guidelines / खेती प्राकृतिक तरीके से (बिना केमिकल) या कंपनी की गाइडलाइन के अनुसार की जाएगी',
      'If farming is done as per company guidelines and crop gets damaged, the company will bear labor and farming cost / यदि कंपनी की गाइडलाइन के अनुसार खेती करने पर फसल खराब होती है, तो मेहनत व खेत खर्च का भुगतान कंपनी करेगी',
    ],
  },
  {
    title: 'Part 4: Purchase & Payment / भाग – 4 : खरीद एवं भुगतान',
    points: [
      'The company will purchase the crop at ₹250–₹350 per kg / कंपनी फसल ₹250 से ₹350 प्रति किलो की दर से खरीदेगी',
      'Payment will be made on the same day after proper measurement / कटाई के बाद नाप-तोल कर उसी दिन भुगतान किया जाएगा',
      'The farmer is free to sell the crop anywhere else (no restriction) / किसान कहीं भी अपनी फसल बेच सकता है, इस पर कोई रोक नहीं होगी',
    ],
  },
  {
    title: 'Part 5: Insurance & Safety / भाग – 5 : बीमा एवं सुरक्षा',
    points: [
      'In case of natural disasters (flood, drought, storm), compensation will be provided through insurance / प्राकृतिक आपदा (बाढ़, सूखा, तूफान) की स्थिति में बीमा के माध्यम से भुगतान किया जाएगा',
    ],
  },
];

export const AGREEMENT_DECLARATION =
  'I confirm that I have understood all the above terms and agree to them. / मैं पुष्टि करता/करती हूँ कि मैंने ऊपर दी गई सभी शर्तों को समझ लिया है और उनसे सहमत हूँ।';
