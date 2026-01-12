require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const twilio = require('twilio');
const admin = require('firebase-admin');

// --- 1. FIREBASE INITIALIZATION ---
const serviceAccount = {
  "type": process.env.FIREBASE_TYPE,
  "project_id": process.env.FIREBASE_PROJECT_ID,
  "private_key_id": process.env.FIREBASE_PRIVATE_KEY_ID,
  "private_key": process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  "client_email": process.env.FIREBASE_CLIENT_EMAIL,
  "client_id": process.env.FIREBASE_CLIENT_ID,
  "auth_uri": process.env.FIREBASE_AUTH_URI,
  "token_uri": process.env.FIREBASE_TOKEN_URI,
  "auth_provider_x509_cert_url": process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  "client_x509_cert_url": process.env.FIREBASE_CLIENT_X509_CERT_URL
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});
const db = admin.database();

// --- 2. EXPRESS SETUP ---
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

// --- 3. CONSTANTS & CONFIG ---
const PORT = process.env.PORT || 3000;
const ADMIN_PHONE = process.env.ADMIN_PHONE;
const RIDER_REG_CODE = process.env.RIDER_REG_CODE;
const DELIVERY_FEE = parseInt(process.env.DELIVERY_FEE) || 500;
const SHOPPING_FEE = parseInt(process.env.SHOPPING_FEE) || 500;
const SUPPORT_PHONE = "+2349138765380";

// --- TWILIO CLIENT ---
const client = new twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// --- FORCE SANDBOX SENDER ID ---
const SANDBOX_NUMBER = "whatsapp:+14155238886";

// --- HELPER: FORMAT NUMBERS FOR WHATSAPP ---
function formatWhatsappNumber(number) {
  if (!number) return number;
  let clean = number.replace(/whatsapp:/g, '').trim();
  return `whatsapp:${clean}`;
}

// --- 4. MENU DATA (21 VENDORS) ---
const FREE_SOUPS = ["Egusi", "Okro", "Ewedu", "Vegetable", "Gbegiri", "Gbegiri & Ewedu"];

const VENDORS = [
  {
    id: "bissy_joy",
    name: "Bissy Joy Eatery",
    address: "Bissy Joy Eatery Kitchen",
    categories: {
      "RICE_MEALS": [
        { id: 1, name: "White Rice", reg: 2500, ext: 3000 },
        { id: 2, name: "Jollof & Fried Rice", reg: 2500, ext: 3000 },
        { id: 3, name: "Chinese Rice", reg: 4000, ext: 5000 },
        { id: 4, name: "Village Rice", reg: 4000, ext: 4500 },
        { id: 5, name: "Jollof Macaroni", reg: 3000, ext: 3500 },
        { id: 6, name: "Jollof Spaghetti", reg: 3000, ext: 3500 },
        { id: 7, name: "Ofada Rice", reg: 4000, ext: 5000 },
        { id: 8, name: "Beans & Rice", reg: 3000, ext: 3500 }
      ],
      "SWALLOWS": [
        { id: 9, name: "Yam Porridge", reg: 3000, ext: 3500 },
        { id: 10, name: "Yam & Egg", reg: 3000, ext: 3500 },
        { id: 11, name: "Beans & Bread", reg: 2500, ext: 3000 },
        { id: 12, name: "Eba", reg: 2500, ext: 3000 },
        { id: 13, name: "Amala", reg: 2500, ext: 3000 },
        { id: 14, name: "Fufu", reg: 3000, ext: 3500 },
        { id: 15, name: "Pounded Yam", reg: 2500, ext: 3000 }
      ],
      "PROTEINS": [
        { id: 16, name: "Pepper Soup", reg: 2800, ext: 3000 },
        { id: 17, name: "Chicken", reg: 2000, ext: 2500 },
        { id: 18, name: "Turkey", reg: 3500, ext: 4000 },
        { id: 19, name: "Fish", reg: 2000, ext: 2500 },
        { id: 20, name: "Assorted", reg: 500, ext: 1000 },
        { id: 21, name: "Goat Meat", reg: 500, ext: 1000 },
        { id: 22, name: "Ponmo", reg: 200, ext: 500 },
        { id: 23, name: "Beef", reg: 500, ext: 500 },
        { id: 24, name: "Egg", reg: 300, ext: 300 }
      ]
    }
  },
  {
    id: "tee_jay",
    name: "Tee Jay Frozen Food",
    address: "Tee Jay Location",
    categories: {
      "Fish Per Kilo": [
        { id: 1, name: "Shawa", reg: 3400, ext: 3400 },
        { id: 2, name: "Titus", reg: 7000, ext: 7000 },
        { id: 3, name: "Hake", reg: 5200, ext: 5200 },
        { id: 4, name: "Kote", reg: 4000, ext: 4000 },
        { id: 5, name: "Croacker", reg: 6000, ext: 6000 },
        { id: 6, name: "Snail", reg: 7000, ext: 7000 }
      ],
      "Turkey Per Kilo": [
        { id: 7, name: "Turkey wings", reg: 9999, ext: 9999 },
        { id: 8, name: "Turkey finger", reg: 7000, ext: 7000 },
        { id: 9, name: "Chicken Filet", reg: 6200, ext: 6200 }
      ],
      "Chicken Per Kilo": [
        { id: 10, name: "Chicken", reg: 4600, ext: 4600 },
        { id: 11, name: "Gizzard", reg: 5200, ext: 5200 },
        { id: 12, name: "Leg and head", reg: 2200, ext: 2200 },
        { id: 13, name: "Neck of Chicken", reg: 2500, ext: 2500 },
        { id: 14, name: "Chicken wings", reg: 6000, ext: 6000 },
        { id: 15, name: "Chicken Breast", reg: 5000, ext: 5000 }
      ],
      "Other For Pack": [
        { id: 16, name: "Susages", reg: 2600, ext: 2600 },
        { id: 17, name: "Sharwama Bread", reg: 1300, ext: 1300 },
        { id: 18, name: "Chips/Fries", reg: 4500, ext: 4500 },
        { id: 19, name: "Shrimps", reg: 13000, ext: 13000 },
        { id: 20, name: "Crabs", reg: 6000, ext: 6000 },
        { id: 21, name: "Cheese", reg: 4000, ext: 4000 },
        { id: 22, name: "Chicken Lap", reg: 6000, ext: 6000 }
      ]
    }
  },
  {
    id: "biggy_shack",
    name: "BIGGY’S SHACK SHARWAMA",
    address: "Biggy Location",
    categories: {
      "Sharwama & Combos": [
        { id: 1, name: "Double sausage chicken", reg: 3000, ext: 3000 },
        { id: 2, name: "Double sausage extra chicken", reg: 3500, ext: 3500 },
        { id: 3, name: "Double sausage chicken/suya", reg: 4000, ext: 4000 },
        { id: 4, name: "Double Sausage Suya filled", reg: 4000, ext: 4000 },
        { id: 5, name: "Combo Extra chicken/Suya", reg: 4500, ext: 4500 },
        { id: 6, name: "Breadwarma", reg: 6000, ext: 6000 },
        { id: 7, name: "BIG MEN SIZE shawarma", reg: 8000, ext: 8000 },
        { id: 8, name: "Chicken and chips", reg: 5000, ext: 5000 },
        { id: 9, name: "Friends Combo", reg: 7500, ext: 7500 }
      ]
    }
  },
  {
    id: "zrof_pharmacy",
    name: "Zrof Pharmacy",
    address: "Zrof Location",
    categories: {
      "Contraceptives & Supplements": [
        { id: 1, name: "POSTINOR 2", reg: 2500, ext: 2500 },
        { id: 2, name: "POST PILL", reg: 2500, ext: 2500 },
        { id: 3, name: "EVENING PRIMROSE OIL", reg: 13200, ext: 13200 },
        { id: 4, name: "BACK-UP emergency contraception pill", reg: 2000, ext: 2000 },
        { id: 5, name: "WELL ROZE CAPSULES", reg: 6200, ext: 6200 },
        { id: 6, name: "OMEGA -H3 BIO-TONIC CAPSULES", reg: 3000, ext: 3000 }
      ],
      "Medicine & Syrups": [
        { id: 7, name: "AMATEM SOFTGEL FORTE", reg: 3000, ext: 3000 },
        { id: 8, name: "LONART -DS", reg: 3700, ext: 3700 },
        { id: 9, name: "MUREQL TABLET", reg: 1700, ext: 1700 },
        { id: 10, name: "OBRON -6 PLUS IRON", reg: 1500, ext: 1500 },
        { id: 11, name: "P-ALAXIN", reg: 2000, ext: 2000 },
        { id: 12, name: "ARTEQUICK", reg: 6000, ext: 6000 },
        { id: 13, name: "CO-MAL 20/120 TABLETS", reg: 1000, ext: 1000 },
        { id: 14, name: "FEROGLOBIN B12", reg: 5800, ext: 5800 },
        { id: 15, name: "STREPSILS INTENSIVE", reg: 3000, ext: 3000 },
        { id: 16, name: "SIROP DYNEWELL PLUS", reg: 7500, ext: 7500 },
        { id: 17, name: "DYNEWELL", reg: 4200, ext: 4200 },
        { id: 18, name: "DE-DEON -5 SIROP", reg: 3500, ext: 3500 }
      ],
      "Appetizers & Others": [
        { id: 19, name: "APETADINE SYRUP", reg: 2000, ext: 2000 },
        { id: 20, name: "ASTYMIN", reg: 4500, ext: 4500 },
        { id: 21, name: "ASTYFER", reg: 4500, ext: 4500 },
        { id: 22, name: "AVRO APETIT SYRUP", reg: 1500, ext: 1500 },
        { id: 23, name: "GOLD APETIT SYRUP", reg: 1500, ext: 1500 },
        { id: 24, name: "KISS", reg: 550, ext: 550 },
        { id: 25, name: "GOLD CIRCLE", reg: 500, ext: 500 },
        { id: 26, name: "DUREX FEELS", reg: 1500, ext: 1500 }
      ]
    }
  },
  {
    id: "yk_noodles",
    name: "YK NOODLES",
    address: "YK Location",
    categories: {
      "Main Course": [
        { id: 1, name: "ROYAL (Noodles w/ Egg, sardine, sausage, Turkey)", reg: 7950, ext: 7950 },
        { id: 2, name: "TROPICANA (Noodles w/ Egg, sardine, Turkey)", reg: 7150, ext: 7150 },
        { id: 3, name: "TURKIT TOP (Noodles w/ Egg, sausage, Turkey)", reg: 6650, ext: 6650 },
        { id: 4, name: "RELISH (Noodles w/ Egg, Turkey)", reg: 5850, ext: 5850 },
        { id: 5, name: "SEA MIX (Noodles w/ Egg, sardine, sausage)", reg: 3950, ext: 3950 },
        { id: 6, name: "DELIGHT (Noodles w/ Egg, sardine)", reg: 3150, ext: 3150 },
        { id: 7, name: "BANGER (Noodles w/ Egg, sausage)", reg: 2650, ext: 2650 },
        { id: 8, name: "CLASSIC (Noodles w/ Egg)", reg: 1850, ext: 1850 },
        { id: 9, name: "PLANTAIN PLATTER (Plantain, Egg/Sausage)", reg: 0, ext: 0 }
      ]
    }
  },
  {
    id: "big_mummy",
    name: "BIG MUMMY’S KITCHEN",
    address: "Big Mummy Location",
    categories: {
      "Rice Meals": [
        { id: 1, name: "Small plate with chicken", reg: 2500, ext: 2500 },
        { id: 2, name: "Big plate with chicken", reg: 3000, ext: 3000 },
        { id: 3, name: "Small plate meat and Egg", reg: 2000, ext: 2000 }
      ],
      "Extras": [
        { id: 4, name: "Extra chicken", reg: 1000, ext: 1000 },
        { id: 5, name: "Extra meat", reg: 300, ext: 300 },
        { id: 6, name: "Extra Egg", reg: 300, ext: 300 }
      ]
    }
  },
  {
    id: "deemeallab",
    name: "DEEMEALLAB – FOOD",
    address: "Deemeallab Location",
    categories: {
      "Everyday Meal": [
        { id: 1, name: "Spaghetti & Sauce", reg: 2000, ext: 2000 },
        { id: 2, name: "Special Fried Rice", reg: 4000, ext: 4000 },
        { id: 3, name: "Fried Rice", reg: 1500, ext: 1500 },
        { id: 4, name: "Eba & Egusi", reg: 1800, ext: 1800 },
        { id: 5, name: "White Rice & Beans", reg: 1700, ext: 1700 },
        { id: 6, name: "Yam Porridge", reg: 1500, ext: 1500 },
        { id: 7, name: "White Rice & Sauce", reg: 1500, ext: 1500 },
        { id: 8, name: "White Rice", reg: 1000, ext: 1000 },
        { id: 9, name: "Plantain", reg: 500, ext: 500 },
        { id: 10, name: "Coleslaw", reg: 1500, ext: 1500 },
        { id: 11, name: "Bread", reg: 1200, ext: 1200 },
        { id: 12, name: "Samosa / Chops", reg: 1500, ext: 1500 },
        { id: 13, name: "Noodles", reg: 1500, ext: 1500 }
      ],
      "Monday Special": [
        { id: 14, name: "Catfish Stew", reg: 2000, ext: 2000 },
        { id: 15, name: "Toast Bread + Coffee", reg: 3500, ext: 3500 },
        { id: 16, name: "Tapioca (Milk & Sugar)", reg: 3000, ext: 3000 },
        { id: 17, name: "Efo Riro / Pounded Yam or Eba", reg: 2500, ext: 2500 },
        { id: 18, name: "Moi Moi", reg: 3000, ext: 3000 }
      ],
      "Proteins": [
        { id: 19, name: "Chicken Wings", reg: 2500, ext: 2500 },
        { id: 20, name: "Beef", reg: 1000, ext: 1000 },
        { id: 21, name: "Assorted", reg: 1000, ext: 1000 },
        { id: 22, name: "Ponmo", reg: 1000, ext: 1000 },
        { id: 23, name: "Kote Fish", reg: 1000, ext: 1000 },
        { id: 24, name: "Panla", reg: 1000, ext: 1000 },
        { id: 25, name: "Egg", reg: 500, ext: 500 },
        { id: 26, name: "Titus Fish", reg: 2500, ext: 2500 },
        { id: 27, name: "Snail", reg: 2500, ext: 2500 },
        { id: 28, name: "Chicken", reg: 2500, ext: 2500 },
        { id: 29, name: "Turkey", reg: 4500, ext: 4500 },
        { id: 30, name: "Gizzard", reg: 1000, ext: 1000 },
        { id: 31, name: "Catfish", reg: 2500, ext: 2500 },
        { id: 32, name: "Smoked Catfish", reg: 2500, ext: 2500 },
        { id: 33, name: "Goat Meat", reg: 2500, ext: 2500 }
      ]
    }
  },
  {
    id: "savore",
    name: "SAVORÉ BY ADEBAYO",
    address: "Savoré Location",
    categories: {
      "Small Plates (With Peppered Chicken)": [
        { id: 1, name: "Fried Rice & Jollof Rice", reg: 3000, ext: 3000 },
        { id: 2, name: "Jollof Rice Only", reg: 3000, ext: 3000 },
        { id: 3, name: "Stir-fry Fried Rice Only", reg: 3000, ext: 3000 },
        { id: 4, name: "Stir-fried Spaghetti", reg: 3200, ext: 3200 }
      ],
      "Big Plates (With Peppered Chicken)": [
        { id: 5, name: "Fried Rice & Jollof Rice", reg: 4000, ext: 4000 },
        { id: 6, name: "Jollof Rice Only", reg: 4000, ext: 4000 },
        { id: 7, name: "Stir-fry Fried Rice Only", reg: 4000, ext: 4000 },
        { id: 8, name: "Stir-fried Spaghetti", reg: 4200, ext: 4200 }
      ],
      "Small Plates (With Peppered Turkey)": [
        { id: 9, name: "Fried Rice & Jollof Rice", reg: 4000, ext: 4000 },
        { id: 10, name: "Jollof Rice Only", reg: 4000, ext: 4000 },
        { id: 11, name: "Stir-fry Fried Rice Only", reg: 4000, ext: 4000 },
        { id: 12, name: "Stir-fried Spaghetti", reg: 4200, ext: 4200 }
      ],
      "Big Plates (With Peppered Turkey)": [
        { id: 13, name: "Fried Rice & Jollof Rice", reg: 5500, ext: 5500 },
        { id: 14, name: "Jollof Rice Only", reg: 5500, ext: 5500 },
        { id: 15, name: "Stir-fry Fried Rice Only", reg: 5500, ext: 5500 },
        { id: 16, name: "Stir-fried Spaghetti", reg: 5700, ext: 5700 }
      ],
      "Extras & Bento Cakes": [
        { id: 17, name: "Plantain", reg: 500, ext: 500 },
        { id: 18, name: "Coleslaw", reg: 500, ext: 500 },
        { id: 19, name: "Extra Chicken", reg: 1500, ext: 1500 },
        { id: 20, name: "Extra Turkey", reg: 3000, ext: 3000 },
        { id: 21, name: "Basic Bento", reg: 8500, ext: 8500 },
        { id: 22, name: "Whipped Cream Bento", reg: 10000, ext: 10000 }
      ]
    }
  },
  {
    id: "royal_chaw",
    name: "ROYAL CHAW SPOT",
    address: "Royal Chaw Location",
    categories: {
      "Sharwama": [
        { id: 1, name: "Without sausage", reg: 2000, ext: 2000 },
        { id: 2, name: "Single sausage", reg: 2500, ext: 2500 },
        { id: 3, name: "Double sausage", reg: 3000, ext: 3000 },
        { id: 4, name: "Royal special", reg: 4000, ext: 4000 },
        { id: 5, name: "Chessy sharwama", reg: 4000, ext: 4000 }
      ],
      "Burger & Fries": [
        { id: 6, name: "Single chicken Burger", reg: 5000, ext: 5000 },
        { id: 7, name: "Double chicken Burger", reg: 6000, ext: 6000 },
        { id: 8, name: "Loaded fries", reg: 5000, ext: 5000 },
        { id: 9, name: "Loaded fries with cheese", reg: 6000, ext: 6000 },
        { id: 10, name: "Chicken and fried", reg: 5000, ext: 5000 },
        { id: 11, name: "Extra chicken", reg: 1500, ext: 1500 },
        { id: 12, name: "Extra fries", reg: 1000, ext: 1000 }
      ],
      "Bread Sharwama & Others": [
        { id: 13, name: "Without sausage", reg: 2000, ext: 2000 },
        { id: 14, name: "Single sausage", reg: 2500, ext: 2500 },
        { id: 15, name: "Double sausage", reg: 3000, ext: 3000 },
        { id: 16, name: "Jumbo bread sharwama", reg: 3500, ext: 3500 },
        { id: 17, name: "Sandwich", reg: 700, ext: 700 },
        { id: 18, name: "Royal pizza", reg: 10000, ext: 10000 },
        { id: 19, name: "Barbecue", reg: 4000, ext: 6500 },
        { id: 20, name: "Nkwobi", reg: 4000, ext: 6000 }
      ]
    }
  },
  {
    id: "hot_oole",
    name: "HOT OOLE",
    address: "Hot Oole Location",
    categories: {
      "Moi Moi & Pap": [
        { id: 1, name: "Special combo moi moi", reg: 1500, ext: 1500 },
        { id: 2, name: "Moi moi with Egg", reg: 700, ext: 700 },
        { id: 3, name: "Moi moi (plain)", reg: 400, ext: 400 },
        { id: 4, name: "Moi moi with fish", reg: 600, ext: 600 },
        { id: 5, name: "Breakfast combo: Pap and milk with moi moi", reg: 3000, ext: 3000 },
        { id: 6, name: "Breakfast combo: Tapioca and milk and moi moi", reg: 3000, ext: 3000 }
      ],
      "Tapioca & Fura": [
        { id: 7, name: "Tapioca (small bowl)", reg: 1200, ext: 1200 },
        { id: 8, name: "Tapioca (big bowl)", reg: 1500, ext: 1500 },
        { id: 9, name: "Fura (small bowl)", reg: 1200, ext: 1200 },
        { id: 10, name: "Fura (big bowl)", reg: 1500, ext: 1500 },
        { id: 11, name: "Extra milk", reg: 300, ext: 300 }
      ],
      "Drinks": [
        { id: 12, name: "Kunu", reg: 1000, ext: 1000 },
        { id: 13, name: "Zobo", reg: 1000, ext: 1000 }
      ]
    }
  },
  {
    id: "wrap_star",
    name: "WRAP STAR MENU",
    address: "Wrap Star Location",
    categories: {
      "SHARWAMA": [
        { id: 1, name: "Chicken alone", reg: 2500, ext: 2500 },
        { id: 2, name: "Beef alone", reg: 2800, ext: 2800 },
        { id: 3, name: "Single sausage", reg: 2700, ext: 2700 },
        { id: 4, name: "Double sausage", reg: 3000, ext: 3000 },
        { id: 5, name: "Chicken & beef", reg: 3000, ext: 3000 },
        { id: 6, name: "Chicken, Beef & A sausage", reg: 3500, ext: 3500 },
        { id: 7, name: "Chicken, Beef & 2 sausage", reg: 3800, ext: 3800 },
        { id: 8, name: "Sharwama special", reg: 4500, ext: 4500 }
      ],
      "BURGER": [
        { id: 9, name: "Single chicken", reg: 4500, ext: 4500 },
        { id: 10, name: "Double chicken", reg: 5000, ext: 5000 },
        { id: 11, name: "Beef suya", reg: 4500, ext: 4500 }
      ],
      "FRIES": [
        { id: 12, name: "Fries & chicken", reg: 5500, ext: 5500 },
        { id: 13, name: "Beef kebab", reg: 2000, ext: 2000 },
        { id: 14, name: "Kebab & FRIES", reg: 4500, ext: 4500 },
        { id: 15, name: "FRIES combo", reg: 7000, ext: 7000 },
        { id: 16, name: "Loaded fries", reg: 6000, ext: 6000 }
      ]
    }
  },
  {
    id: "chao_cocina",
    name: "CHAO COCINA",
    address: "Chao Cocina Location",
    categories: {
      "STIRFRY SPAGHETTI": [
        { id: 1, name: "Large with turkey", reg: 3800, ext: 3800 },
        { id: 2, name: "Medium with turkey", reg: 3300, ext: 3300 },
        { id: 3, name: "Large with asun", reg: 3300, ext: 3300 },
        { id: 4, name: "Medium with asun", reg: 3000, ext: 3000 },
        { id: 5, name: "Extra/only turkey", reg: 2800, ext: 2800 },
        { id: 6, name: "Extra/only asun", reg: 2000, ext: 2000 },
        { id: 7, name: "Extra stirfry", reg: 1000, ext: 1000 },
        { id: 8, name: "Extra sausage", reg: 400, ext: 400 }
      ],
      "Potato fries": [
        { id: 9, name: "Fries & turkey", reg: 5500, ext: 5500 },
        { id: 10, name: "Fries & Asun", reg: 5000, ext: 5000 },
        { id: 11, name: "Plantain per portion", reg: 500, ext: 500 },
        { id: 12, name: "Ketchup", reg: 300, ext: 300 }
      ],
      "Drinks": [
        { id: 13, name: "Bottle water", reg: 300, ext: 300 },
        { id: 14, name: "Soft drinks", reg: 500, ext: 500 },
        { id: 15, name: "Fearless", reg: 600, ext: 600 },
        { id: 16, name: "Malt", reg: 600, ext: 600 },
        { id: 17, name: "Fayrouz", reg: 800, ext: 800 },
        { id: 18, name: "Chivita active", reg: 800, ext: 800 }
      ]
    }
  },
  {
    id: "krafty_kitchen",
    name: "KRAFTY KITCHEN",
    address: "Krafty Kitchen Location",
    categories: {
      "FOOD MENU": [
        { id: 1, name: "Small plate with chicken", reg: 2500, ext: 2500 },
        { id: 2, name: "Big plate with chicken", reg: 3000, ext: 3000 },
        { id: 3, name: "Plantain", reg: 500, ext: 500 },
        { id: 4, name: "Coleslaw", reg: 500, ext: 500 },
        { id: 5, name: "Extra chicken", reg: 2000, ext: 2000 },
        { id: 6, name: "Ofada Rice with chicken, egg & assorted", reg: 4500, ext: 4500 },
        { id: 7, name: "Krafty fruit parfait (Big cup)", reg: 4000, ext: 4000 },
        { id: 8, name: "Krafty fruit parfait (small cup)", reg: 3500, ext: 3500 },
        { id: 9, name: "Fish barbecue", reg: 3000, ext: 3000 },
        { id: 10, name: "Big plate of pasta with chicken", reg: 3500, ext: 3500 },
        { id: 11, name: "Small plate of pasta with chicken", reg: 3000, ext: 3000 },
        { id: 12, name: "Big plate of pasta with beef", reg: 2700, ext: 2700 },
        { id: 13, name: "Small plate of pasta with beef", reg: 2200, ext: 2200 },
        { id: 14, name: "Small plate of rice with beef", reg: 1700, ext: 1700 },
        { id: 15, name: "Big plate of rice with beef", reg: 2200, ext: 2200 },
        { id: 16, name: "Beef", reg: 500, ext: 500 },
        { id: 17, name: "Egg", reg: 400, ext: 400 }
      ],
      "DRINKS": [
        { id: 18, name: "Viju milk", reg: 700, ext: 700 },
        { id: 19, name: "Coke", reg: 500, ext: 500 },
        { id: 20, name: "Fanta", reg: 500, ext: 500 },
        { id: 21, name: "Bottle water", reg: 250, ext: 250 },
        { id: 22, name: "Pepsi", reg: 500, ext: 500 },
        { id: 23, name: "Predator", reg: 600, ext: 600 },
        { id: 24, name: "Fearless", reg: 600, ext: 600 },
        { id: 25, name: "Zobo", reg: 800, ext: 800 },
        { id: 26, name: "Exotic", reg: 800, ext: 800 },
        { id: 27, name: "Active can", reg: 800, ext: 800 },
        { id: 28, name: "Exotic Big", reg: 1800, ext: 1800 },
        { id: 29, name: "Monster", reg: 1500, ext: 1500 },
        { id: 30, name: "Berry blast", reg: 1500, ext: 1500 },
        { id: 31, name: "Puppy orange", reg: 1500, ext: 1500 },
        { id: 32, name: "Nutri milk", reg: 700, ext: 700 }
      ],
      "KRAFTY SHARWAMA": [
        { id: 33, name: "Sharwama without sausage", reg: 2000, ext: 2000 },
        { id: 34, name: "Chicken sharwama", reg: 2500, ext: 2500 },
        { id: 35, name: "Beef sharwama", reg: 2500, ext: 2500 },
        { id: 36, name: "Sharwama combo", reg: 3000, ext: 3000 },
        { id: 37, name: "Sharwama & single sausage", reg: 2500, ext: 2500 },
        { id: 38, name: "Sharwama & Double sausage", reg: 3000, ext: 3000 },
        { id: 39, name: "Special sharwama with a free drink", reg: 4000, ext: 4000 }
      ]
    }
  },
  {
    id: "spag_city",
    name: "SPAG CITY",
    address: "Spag City Location",
    categories: {
      "Spaghetti": [
        { id: 1, name: "Spag & Big Turkey", reg: 6500, ext: 6500 },
        { id: 2, name: "Spag & mid turkey", reg: 4000, ext: 4000 },
        { id: 3, name: "Spag & chicken", reg: 3600, ext: 3600 }
      ],
      "Sharwama & Extras": [
        { id: 4, name: "Sharwama single sausage", reg: 2500, ext: 2500 },
        { id: 5, name: "Double sausage", reg: 3000, ext: 3000 },
        { id: 6, name: "Sausage", reg: 500, ext: 500 },
        { id: 7, name: "Plantain", reg: 500, ext: 500 },
        { id: 8, name: "Coleslaw", reg: 500, ext: 500 },
        { id: 9, name: "Extra beef", reg: 500, ext: 500 },
        { id: 10, name: "Asun", reg: 2000, ext: 2000 }
      ]
    }
  },
  {
    id: "hd_treats",
    name: "HD TREATS",
    address: "HD Treats Location",
    categories: {
      "Burger": [
        { id: 1, name: "Single Chicken Burger", reg: 5000, ext: 5000 },
        { id: 2, name: "Double Chicken Burger", reg: 7000, ext: 7000 },
        { id: 3, name: "Single Beef Burger", reg: 5000, ext: 5000 },
        { id: 4, name: "Double Beef Burger", reg: 7000, ext: 7000 }
      ],
      "Shawarma": [
        { id: 5, name: "Beef Shawarma", reg: 3500, ext: 3500 },
        { id: 6, name: "Chicken Shawarma", reg: 3500, ext: 3500 },
        { id: 7, name: "Jumbo Shawarma", reg: 5000, ext: 5000 },
        { id: 8, name: "Extra Sausage", reg: 500, ext: 500 },
        { id: 9, name: "Extra Chicken", reg: 500, ext: 500 }
      ],
      "Sandwich": [
        { id: 10, name: "Club Chicken Sandwich", reg: 3500, ext: 3500 },
        { id: 11, name: "Club Beef Sandwich", reg: 3500, ext: 3500 },
        { id: 12, name: "Philly Cheese Steak", reg: 7000, ext: 7000 },
        { id: 13, name: "Chicken Cheese Melt", reg: 7000, ext: 7000 }
      ],
      "Beverages & Parfait": [
        { id: 14, name: "Fruity Zobo", reg: 1500, ext: 1500 },
        { id: 15, name: "Pineapple Juice", reg: 2500, ext: 2500 },
        { id: 16, name: "Watermelon Juice", reg: 2500, ext: 2500 },
        { id: 17, name: "Creamy Yoghurt", reg: 2500, ext: 2500 },
        { id: 18, name: "Yoghurt Parfait (500ml)", reg: 6500, ext: 6500 },
        { id: 19, name: "Yoghurt Parfait (1 litre)", reg: 12500, ext: 12500 },
        { id: 20, name: "Greek Yoghurt Sweetened/Unsweetened (500ml)", reg: 5000, ext: 5000 },
        { id: 21, name: "Greek Yoghurt Sweetened/Unsweetened (1 litre)", reg: 9500, ext: 9500 }
      ],
      "Milkshake & Pizza": [
        { id: 22, name: "Vanilla Milkshake", reg: 7000, ext: 7000 },
        { id: 23, name: "Oreo Milkshake", reg: 7000, ext: 7000 },
        { id: 24, name: "Strawberry Milkshake", reg: 7000, ext: 7000 },
        { id: 25, name: "Banana Milkshake", reg: 7000, ext: 7000 },
        { id: 26, name: "Beef Pizza", reg: 6000, ext: 10000 },
        { id: 27, name: "Chicken Pizza", reg: 6000, ext: 10000 },
        { id: 28, name: "Margherita Pizza", reg: 6000, ext: 10000 },
        { id: 29, name: "Pepperoni Pizza", reg: 7000, ext: 11000 },
        { id: 30, name: "BBQ Pizza", reg: 8000, ext: 12000 },
        { id: 31, name: "Supreme Pizza", reg: 10000, ext: 16000 }
      ]
    }
  },
  {
    id: "imole_patisserie",
    name: "IMOLE’S PATISSERIE",
    address: "Imole Location",
    categories: {
      "Pastries & Snacks": [
        { id: 1, name: "Chicken pie", reg: 1000, ext: 1000 },
        { id: 2, name: "Meatpie", reg: 1000, ext: 1000 },
        { id: 3, name: "Sausage roll", reg: 500, ext: 500 },
        { id: 4, name: "Full sausage", reg: 1000, ext: 1000 },
        { id: 5, name: "Egg rolls", reg: 500, ext: 500 },
        { id: 6, name: "Milky doughnuts pack of 3", reg: 4500, ext: 4500 },
        { id: 7, name: "Milky doughnuts pack of 6", reg: 8500, ext: 8500 },
        { id: 8, name: "Small chops with chicken", reg: 3500, ext: 3500 },
        { id: 9, name: "Small chops with beef", reg: 2500, ext: 2500 },
        { id: 10, name: "Ice cream covered plates", reg: 1000, ext: 2200 }
      ],
      "Cakes & Parfaits": [
        { id: 11, name: "Cake slice cakes (naked big)", reg: 2500, ext: 2500 },
        { id: 12, name: "Cake slice cakes (customized)", reg: 4000, ext: 4000 },
        { id: 13, name: "Birthday cakes size 6 single layer", reg: 15000, ext: 15000 },
        { id: 14, name: "Birthday cakes size 8 single layer", reg: 20000, ext: 20000 },
        { id: 15, name: "Birthday cakes size 10 single layer", reg: 25000, ext: 25000 },
        { id: 16, name: "Cake parfaits small", reg: 3500, ext: 3500 },
        { id: 17, name: "Cake parfaits big", reg: 4500, ext: 4500 }
      ]
    }
  },
  {
    id: "finey_prices",
    name: "FINEY PRICES",
    address: "Finey Location",
    categories: {
      "Noodles": [
        { id: 1, name: "Stirfry noodles with beef or boiled egg", reg: 1800, ext: 1800 },
        { id: 2, name: "Noodles with fried egg", reg: 2000, ext: 2000 },
        { id: 3, name: "Stirfry noodles with chicken", reg: 3000, ext: 3000 },
        { id: 4, name: "Stirfry noodles with fish", reg: 2800, ext: 2800 },
        { id: 5, name: "Stirfry noodles with turkey", reg: 4500, ext: 5000 }
      ],
      "Peppered Menu": [
        { id: 6, name: "Gizdodo or asun mini", reg: 2000, ext: 2000 },
        { id: 7, name: "Gizdodo or asun maxi", reg: 5000, ext: 5000 },
        { id: 8, name: "Peppered snails", reg: 2500, ext: 5000 },
        { id: 9, name: "Peppered ponmo", reg: 1500, ext: 3000 },
        { id: 10, name: "Peppered beef and plantain", reg: 3500, ext: 6500 },
        { id: 11, name: "Peppered goat meat and plantain", reg: 4000, ext: 7500 },
        { id: 12, name: "Peppered chicken and plantain", reg: 3500, ext: 6500 },
        { id: 13, name: "Peppered turkey and plantain", reg: 5000, ext: 9500 }
      ]
    }
  },
  {
    id: "royals_treat",
    name: "ROYAL’S TREAT AND TIDBITS",
    address: "Royals Treat Location",
    categories: {
      "Main Meals": [
        { id: 1, name: "Stir fry spaghetti with chicken", reg: 4500, ext: 4500 },
        { id: 2, name: "Extra plate stir fry spaghetti with chicken", reg: 5500, ext: 5500 },
        { id: 3, name: "Yam and egg sauce", reg: 4500, ext: 4500 },
        { id: 4, name: "Basmati Jambalaya rice and turkey", reg: 8500, ext: 8500 },
        { id: 5, name: "Stir spaghetti chicken and plantain", reg: 5000, ext: 5000 },
        { id: 6, name: "Basmati rice and gizzdodo", reg: 7000, ext: 7000 }
      ],
      "Snacks & Extras": [
        { id: 7, name: "Small chops (Combo)", reg: 4500, ext: 4500 },
        { id: 8, name: "Chicken pie and meat pie", reg: 1200, ext: 1200 },
        { id: 9, name: "Buns", reg: 200, ext: 200 },
        { id: 10, name: "Doughnuts", reg: 700, ext: 700 },
        { id: 11, name: "Egg roll", reg: 700, ext: 700 },
        { id: 12, name: "Fruit parfait", reg: 4500, ext: 4500 },
        { id: 13, name: "Cake parfait", reg: 3500, ext: 3500 }
      ]
    }
  },
  {
    id: "okele_joint",
    name: "OKELE JOINT",
    address: "Okele Joint Location",
    categories: {
      "SWALLOWS": [
        { id: 1, name: "Amala", reg: 300, ext: 300 },
        { id: 2, name: "Pounded yam", reg: 500, ext: 500 },
        { id: 3, name: "Semo", reg: 200, ext: 200 },
        { id: 4, name: "Fufu", reg: 200, ext: 200 },
        { id: 5, name: "Eba", reg: 200, ext: 200 },
        { id: 6, name: "Tuwo Rice", reg: 200, ext: 200 }
      ],
      "Proteins & Soup": [
        { id: 7, name: "Cow Meat", reg: 200, ext: 200 },
        { id: 8, name: "Goat Meat", reg: 500, ext: 500 },
        { id: 9, name: "Fish", reg: 1000, ext: 2000 },
        { id: 10, name: "Wara", reg: 300, ext: 300 },
        { id: 11, name: "Ponmo", reg: 300, ext: 300 },
        { id: 12, name: "Cow Leg", reg: 400, ext: 500 },
        { id: 13, name: "Chicken", reg: 1500, ext: 1500 },
        { id: 14, name: "Smoke Fish", reg: 500, ext: 500 },
        { id: 15, name: "Hake Fish", reg: 1000, ext: 1000 }
      ]
    }
  },
  {
    id: "iya_afusat",
    name: "Iya Afusat Kitchen",
    address: "Iya Afusat Location",
    categories: {
      "Rice & Beans": [
        { id: 1, name: "White rice", reg: 500, ext: 1000 },
        { id: 2, name: "Rice and bean", reg: 500, ext: 1000 },
        { id: 3, name: "Jollof rice", reg: 500, ext: 1000 },
        { id: 4, name: "Bean", reg: 500, ext: 1000 },
        { id: 5, name: "Plantain", reg: 200, ext: 200 },
        { id: 6, name: "Spag", reg: 200, ext: 200 },
        { id: 7, name: "Bread", reg: 500, ext: 500 }
      ],
      "SWALLOWS": [
        { id: 8, name: "Semo", reg: 200, ext: 200 },
        { id: 9, name: "Eba", reg: 200, ext: 200 },
        { id: 10, name: "Fufu", reg: 200, ext: 200 },
        { id: 11, name: "Iyan", reg: 200, ext: 200 },
        { id: 12, name: "Amala", reg: 200, ext: 200 }
      ],
      "Protein": [
        { id: 13, name: "Beef", reg: 200, ext: 500 },
        { id: 14, name: "Ponmo", reg: 500, ext: 500 },
        { id: 15, name: "Titus fish", reg: 1000, ext: 1000 },
        { id: 16, name: "Wara", reg: 500, ext: 500 },
        { id: 17, name: "Egg", reg: 400, ext: 400 }
      ]
    }
  },
  {
    id: "jamblack_hubs",
    name: "JAMBLACK HUBS",
    address: "Jamblack Location",
    categories: {
      "Shawarma": [
        { id: 1, name: "Medium", reg: 3500, ext: 3500 },
        { id: 2, name: "Large", reg: 5000, ext: 5000 }
      ],
      "Pasta & Meals": [
        { id: 3, name: "Spaghetti with Chicken", reg: 3500, ext: 3500 },
        { id: 4, name: "Spaghetti with Turkey", reg: 5500, ext: 5500 },
        { id: 5, name: "Penne Pasta with Chicken", reg: 4500, ext: 4500 }
      ],
      "Extras / Add-Ons": [
        { id: 6, name: "Turkey", reg: 6500, ext: 6500 },
        { id: 7, name: "Toast Bread", reg: 700, ext: 700 },
        { id: 8, name: "Beef", reg: 500, ext: 500 },
        { id: 9, name: "Ponmo", reg: 500, ext: 500 },
        { id: 10, name: "Sausage", reg: 500, ext: 500 },
        { id: 11, name: "Plantain", reg: 500, ext: 500 }
      ]
    }
  },
  {
    id: "opeyemi_food",
    name: "OPEYEMI FOOD CANTEEN",
    address: "Opeyemi Food Location",
    categories: {
      "SWALLOWS": [
        { id: 1, name: "Pounded Yam", reg: 600, ext: 600 },
        { id: 2, name: "Amala", reg: 200, ext: 200 },
        { id: 3, name: "Eba", reg: 200, ext: 200 },
        { id: 4, name: "Semo", reg: 200, ext: 200 }
      ],
      "Proteins": [
        { id: 5, name: "Beef", reg: 500, ext: 500 },
        { id: 6, name: "Turkey", reg: 4000, ext: 4000 },
        { id: 7, name: "Ponmo", reg: 500, ext: 500 },
        { id: 8, name: "Titus fish", reg: 2000, ext: 2000 },
        { id: 9, name: "Wara", reg: 500, ext: 500 }
      ]
    }
  }
];

// --- 5. HELPERS ---
function generateId() {
  return Math.floor(1000 + Math.random() * 9000);
}

function formatCurrency(amount) {
  return `₦${amount.toLocaleString()}`;
}

// Helper to append instructions to messages
function sendResponse(twiml, message, showInstructions = true) {
  let finalMessage = message;
  if (showInstructions) {
    finalMessage += `\n\n(Text '0' to go back to previous step)`;
    finalMessage += `\n(Text 'Menu' to go to Main Menu)`;
  }
  twiml.message(finalMessage);
}

// Helper to handle Back Navigation logic
async function goBackStep(from, user, twiml) {
  const map = {
    'vendor_select': 'main_menu',
    'category_select': 'vendor_select',
    'item_select': 'category_select',
    'size_select': 'item_select',
    'quantity_select': 'item_select',
    'soup_select': 'quantity_select',
    'protein_loop': 'quantity_select',
    'protein_select': 'protein_loop',
    'protein_size': 'protein_select',
    'protein_qty': 'protein_select',
    'add_more_or_checkout': 'protein_loop',
    'errand_type': 'main_menu',
    'errand_details': 'errand_type',
    'pickup_description': 'errand_type',
    'vendor_name': 'pickup_description',
    'vendor_phone': 'vendor_name',
    'customer_name': 'vendor_phone',
    'customer_phone': 'customer_name',
    'pickup_location': 'customer_phone',
    'delivery_location': 'pickup_location',
    'confirm_order': 'delivery_location'
  };

  const prevStep = map[user.step];
  
  if (!prevStep) {
    // If no mapping found, just restart
    await resetUser(from, twiml);
    return;
  }

  await db.ref(`users/${from}/step`).set(prevStep);

  // Re-trigger the appropriate handler to show the menu
  if (prevStep === 'main_menu') {
    await handleMainMenu(from, null, twiml);
  } else if (prevStep === 'vendor_select') {
    let menuText = `🏪 *Select a Vendor*\n\n`;
    VENDORS.forEach((v, index) => menuText += `${index + 1}. ${v.name}\n`);
    menuText += `\nReply with the vendor number.`;
    sendResponse(twiml, menuText, true);
  } else if (prevStep === 'category_select') {
    await showCategories(from, twiml);
  } else if (prevStep === 'quantity_select') {
    // If going back to item select, we need to show items
    await handleCategorySelect(from, (Object.keys(VENDORS.find(v=>v.id===user.selected_vendor_id).categories).indexOf(user.current_category) + 1), twiml);
  } else if (prevStep === 'errand_type') {
     sendResponse(twiml, `🏃 *Select Errand Type*\n\n1. 🛒 Market Shopping\n2. 📦 Pick Up Item\n3. 💊 Pharmacy / Supermarket\n4. 📝 Campus Task\n\nReply with number.`, true);
  } else {
    // Generic fallback for form steps
    sendResponse(twiml, "⬅️ Going back to the previous step...", true);
  }
}

// --- 6. MAIN WEBHOOK ROUTE ---
app.post('/whatsapp', async (req, res) => {
  const twiml = new twilio.twiml.MessagingResponse();
  const from = req.body.From;
  const body = (req.body.Body || '').trim();
  const msg = body.toLowerCase();
  const originalMsg = body;
  const numMedia = parseInt(req.body.NumMedia) || 0;

  console.log(`[${new Date().toISOString()}] From: ${from}, Msg: ${body}, Media: ${numMedia}`);

  try {
    // --- A. SUPPORT KEYWORDS ---
    if (msg.includes('support') || msg.includes('help') || msg.includes('agent') || msg.includes('problem')) {
        twiml.message(`🆘 *Customer Support*\n\nIf you are having trouble with the bot, please contact our agent directly:\n\n📞 WhatsApp: ${SUPPORT_PHONE}`);
        return res.type('text/xml').send(twiml.toString());
    }

    // --- B. GLOBAL CANCEL COMMAND (PRIORITY) ---
    // Works at ANY time, including after payment
    if (msg === 'cancel' || msg === 'cancel order') {
      const userSnap = await db.ref(`users/${from}`).once('value');
      const user = userSnap.val();
      
      // If there is an active order in DB, mark it cancelled
      if (user && user.last_order_id) {
        await db.ref(`orders/${user.last_order_id}/status`).set('cancelled_by_user');
      }

      // Reset user session
      await db.ref(`users/${from}`).set({
        step: 'main_menu',
        cart: [],
        order_type: null,
        last_order_id: null // Clear active order
      });
      
      twiml.message("🚫 *Order Cancelled.*\n\nYour session has been reset. Reply 'Menu' to start a new order.");
      return res.type('text/xml').send(twiml.toString());
    }

    // --- C. MEDIA HANDLING (Payment Screenshots) ---
    if (numMedia > 0) {
      const userSnap = await db.ref(`users/${from}`).once('value');
      const user = userSnap.val();

      if (user && user.step === 'awaiting_payment') {
        await createOrderInDB(from, user, twiml, req.body.MediaUrl0);
        return res.type('text/xml').send(twiml.toString());
      } else {
        sendResponse(twiml, "Please complete the text steps first. Reply 'Menu' to restart.", false);
        return res.type('text/xml').send(twiml.toString());
      }
    }

    // --- D. RIDER REGISTRATION ---
    if (msg.startsWith('register rider ')) {
      const parts = originalMsg.split(' ');
      const code = parts[2];
      const riderName = parts.slice(3).join(' ') || "Rider";

      if (code === RIDER_REG_CODE) {
        await db.ref(`riders/${from}`).set({
          name: riderName,
          status: 'inactive',
          phone: from,
          joined_at: new Date().toISOString()
        });
        sendResponse(twiml, `✅ Registration Successful!\n\nWelcome ${riderName}. Text "ON DUTY" to start.`, false);
      } else {
        sendResponse(twiml, '❌ Invalid Registration Code.', false);
      }
      return res.type('text/xml').send(twiml.toString());
    }

    const userSnap = await db.ref(`users/${from}`).once('value');
    const user = userSnap.val() || { step: 'new' };

    // --- E. BACKWARD NAVIGATION (Reply 0) ---
    // Only works if there is NO active paid order (to avoid confusion)
    if (msg === '0' && !user.last_order_id) {
        if (user.step !== 'main_menu' && user.step !== 'new') {
            await goBackStep(from, user, twiml);
            return res.type('text/xml').send(twiml.toString());
        }
    }

    // --- F. CHECK ACTIVE ORDER STATUS (Robustness) ---
    // If an active order exists, re-send status to ensure user doesn't break flow
    const orderId = user.last_order_id;
    if (orderId) {
        const orderSnap = await db.ref(`orders/${orderId}`).once('value');
        const order = orderSnap.val();

        // If order is active (not cancelled/delivered), re-send status
        if (order && (order.status === 'pending_payment' || order.status === 'seeking_rider' || order.status === 'rider_accepted')) {
            let msg = "";
            if (order.status === 'pending_payment') {
                msg = "⏳ *Please Wait*\n\nWe are confirming your payment.\n\nDon't reply to this message, you will be updated soon.";
            } else if (order.status === 'seeking_rider') {
                msg = "⏳ *Please Wait*\n\nWe are assigning a rider to your order.\n\nDon't reply to this text to avoid mix up. You will be updated shortly.";
            } else if (order.status === 'rider_accepted') {
                msg = "⏳ *Rider Assigned*\n\nYour order has been accepted by a rider.\n\nDon't reply here. Contact the rider directly.";
            }
            twiml.message(msg);
            return res.type('text/xml').send(twiml.toString());
        }
    }

    // --- G. ADMIN COMMANDS ---
    const formattedFrom = formatWhatsappNumber(from);
    const formattedAdminPhone = formatWhatsappNumber(ADMIN_PHONE);

    if (formattedFrom === formattedAdminPhone) {
      if (msg.startsWith('approve ')) {
        const orderId = msg.split(' ')[1];
        await approveOrder(orderId);
        twiml.message(`Order #${orderId} Approved.`);
        return res.type('text/xml').send(twiml.toString());
      }
      if (msg.startsWith('reject ')) {
        const orderId = msg.split(' ')[1];
        await rejectOrder(orderId);
        twiml.message(`Order #${orderId} Rejected.`);
        return res.type('text/xml').send(twiml.toString());
      }
    }

    // --- H. RIDER COMMANDS ---
    const riderSnap = await db.ref(`riders/${from}`).once('value');
    const rider = riderSnap.val();

    if (rider) {
      if (msg === 'on duty') {
        await db.ref(`riders/${from}/status`).set('on_duty');
        twiml.message('✅ You are ON DUTY.');
        return res.type('text/xml').send(twiml.toString());
      }
      if (msg === 'off duty') {
        await db.ref(`riders/${from}/status`).set('inactive');
        twiml.message('⚠️ You are OFF DUTY.');
        return res.type('text/xml').send(twiml.toString());
      }
      if (msg.startsWith('accept ')) {
        const orderId = msg.split(' ')[1];
        await acceptOrder(from, orderId, twiml);
        return res.type('text/xml').send(twiml.toString());
      }
      if (msg.startsWith('delivered')) {
        await updateOrderStatus(msg.split(' ')[1], 'delivered', twiml, from);
        return res.type('text/xml').send(twiml.toString());
      }
    }

    // --- I. CUSTOMER FLOW STATE MACHINE ---
    if (msg === 'hi' || msg === 'menu' || msg === 'start') {
      await resetUser(from, twiml);
      return res.type('text/xml').send(twiml.toString());
    }

    switch (user.step) {
      case 'new':
      case 'main_menu':
        await handleMainMenu(from, msg, twiml);
        break;
      case 'vendor_select':
        const vendorIndex = parseInt(msg) - 1;
        if (vendorIndex >= 0 && vendorIndex < VENDORS.length) {
            const selectedVendor = VENDORS[vendorIndex];
            await db.ref(`users/${from}`).update({
            step: 'category_select',
            selected_vendor_id: selectedVendor.id
            });
            await showCategories(from, twiml);
        } else {
            sendResponse(twiml, "Invalid vendor number. Please try again.", true);
        }
        break;
      case 'category_select':
        await handleCategorySelect(from, parseInt(msg), twiml);
        break;
      case 'item_select':
        await handleItemSelect(from, parseInt(msg), twiml);
        break;
      case 'size_select':
        await handleSizeSelect(from, msg, twiml);
        break;
      case 'quantity_select':
        await handleQuantitySelect(from, msg, twiml);
        break;
      case 'soup_select':
        await handleSoupSelect(from, msg, twiml);
        break;
      case 'protein_loop':
        await handleProteinLoop(from, msg, twiml);
        break;
      case 'protein_select':
        await handleProteinSelect(from, parseInt(msg), twiml);
        break;
      case 'protein_size':
        await handleProteinSize(from, msg, twiml);
        break;
      case 'protein_qty':
        await handleProteinQty(from, msg, twiml);
        break;
      case 'add_more_or_checkout':
        if (msg === '1') {
           await showCategories(from, twiml);
        } else if (msg === '2') {
           await db.ref(`users/${from}`).update({ step: 'customer_name' });
           sendResponse(twiml, "📝 Please provide your Full Name.", true);
        } else {
           sendResponse(twiml, "Reply 1 or 2.", true);
        }
        break;
      case 'errand_type':
        await handleErrandType(from, parseInt(msg), twiml);
        break;
      case 'errand_details':
        await handleErrandDetails(from, originalMsg, twiml);
        break;
      case 'pickup_description':
        await handlePickupDescription(from, originalMsg, twiml);
        break;
      case 'vendor_name':
        await handleVendorName(from, originalMsg, twiml);
        break;
      case 'vendor_phone':
        await handleVendorPhone(from, originalMsg, twiml);
        break;
      case 'customer_name':
        await handleCustomerName(from, originalMsg, twiml);
        break;
      case 'customer_phone':
        await handleCustomerPhone(from, originalMsg, twiml);
        break;
      case 'pickup_location':
        await handlePickupLocation(from, originalMsg, twiml);
        break;
      case 'pickup_location_manual':
        await handlePickupLocationManual(from, originalMsg, twiml);
        break;
      case 'delivery_location':
        await handleDeliveryLocation(from, originalMsg, twiml);
        break;
      case 'confirm_order':
        await handleFinalConfirm(from, msg, twiml);
        break;
      case 'rate_rider':
        await handleRateRider(from, msg, twiml);
        break;
      case 'rate_service':
        await handleRateService(from, msg, twiml);
        break;
      default:
        sendResponse(twiml, "I didn't understand that. Reply 'Menu' to restart.", true);
    }

    res.type('text/xml').send(twiml.toString());

  } catch (error) {
    console.error("Error:", error);
    twiml.message("❌ Server error. Please try again.");
    res.type('text/xml').send(twiml.toString());
  }
});

// --- 7. LOGIC HANDLERS (CUSTOMER) ---

async function resetUser(from, twiml) {
  await db.ref(`users/${from}`).set({
    step: 'main_menu',
    cart: [],
    order_type: null,
    errand_data: {},
    last_order_id: null // Ensure order is cleared on reset
  });
  const welcomeMsg = `🍽️ *Welcome to ChowZone!*\n\nHow can we help you today?\n\n1. Order Food\n2. Errands (Market/Pharmacy/Pickup)\n\nReply with number 1 or 2.`;
  twiml.message(welcomeMsg);
}

async function handleMainMenu(from, msg, twiml) {
  if (msg === '1') {
    await db.ref(`users/${from}`).update({
      step: 'vendor_select',
      order_type: 'food'
    });

    let menuText = `🏪 *Select a Vendor*\n\n`;
    VENDORS.forEach((v, index) => {
      menuText += `${index + 1}. ${v.name}\n`;
    });
    menuText += `\nReply with the vendor number.`;
    sendResponse(twiml, menuText, true);

  } else if (msg === '2') {
    await db.ref(`users/${from}`).update({
      step: 'errand_type',
      order_type: 'errand'
    });
    sendResponse(twiml, `🏃 *Select Errand Type*\n\n1. 🛒 Market Shopping\n2. 📦 Pick Up Item\n3. 💊 Pharmacy / Supermarket\n4. 📝 Campus Task\n\nReply with number.`, true);
  } else {
    sendResponse(twiml, "Invalid option. Reply 1 or 2.", true);
  }
}

async function showCategories(from, twiml) {
  await db.ref(`users/${from}/step`).set('category_select');

  const userSnap = await db.ref(`users/${from}`).once('value');
  const user = userSnap.val();
  const vendor = VENDORS.find(v => v.id === user.selected_vendor_id);

  if (!vendor) {
    twiml.message("Error finding vendor. Please restart.");
    return;
  }

  let msg = `🍽️ *${vendor.name} Categories*\n\n`;
  const catKeys = Object.keys(vendor.categories);

  catKeys.forEach((key, index) => {
    msg += `${index + 1}. ${key.replace('_', ' ')}\n`;
  });

  msg += `\nReply number.`;
  sendResponse(twiml, msg, true);
}

async function handleCategorySelect(from, choice, twiml) {
  const userSnap = await db.ref(`users/${from}`).once('value');
  const user = userSnap.val();
  const vendor = VENDORS.find(v => v.id === user.selected_vendor_id);

  const catKeys = Object.keys(vendor.categories);
  const selectedKey = catKeys[choice - 1];

  if (!selectedKey) return sendResponse(twiml, "Invalid category number.", true);

  await db.ref(`users/${from}`).update({
    step: 'item_select',
    current_category: selectedKey
  });

  let msg = `*${selectedKey.replace('_', ' ')}*\n\n`;
  vendor.categories[selectedKey].forEach(item => {
    const priceTxt = (item.reg === item.ext) ? formatCurrency(item.reg) : `${formatCurrency(item.reg)} / ${formatCurrency(item.ext)}`;
    msg += `${item.id}. ${item.name} - ${priceTxt}\n`;
  });
  msg += `\nReply item number.`;
  sendResponse(twiml, msg, true);
}

async function handleItemSelect(from, id, twiml) {
  const userSnap = await db.ref(`users/${from}`).once('value');
  const user = userSnap.val();
  const vendor = VENDORS.find(v => v.id === user.selected_vendor_id);

  const cat = vendor.categories[user.current_category];
  const item = cat.find(i => i.id === id);

  if (!item) return sendResponse(twiml, "Invalid item number.", true);

  await db.ref(`users/${from}`).update({
    step: 'size_select',
    selected_item: item
  });

  if (item.reg === item.ext) {
    await db.ref(`users/${from}/step`).set('quantity_select');
    sendResponse(twiml, `*${item.name}*\n\nPrice: ${formatCurrency(item.reg)}\n\nHow many? (Enter number)`, true);
  } else {
    let msg = `*${item.name}*\n\nSelect Portion:\n1. Regular (${formatCurrency(item.reg)})\n2. Extra (${formatCurrency(item.ext)})\n\nReply 1 or 2.`;
    sendResponse(twiml, msg, true);
  }
}

async function handleSizeSelect(from, msg, twiml) {
  const userSnap = await db.ref(`users/${from}`).once('value');
  const item = userSnap.val().selected_item;

  if (msg !== '1' && msg !== '2') {
      return sendResponse(twiml, "Invalid choice. Reply 1 for Regular or 2 for Extra.", true);
  }

  const size = msg === '1' ? 'reg' : 'ext';
  const price = item[size];
  const label = msg === '1' ? 'Regular' : 'Extra';

  await db.ref(`users/${from}`).update({
    step: 'quantity_select',
    selected_item_price: price,
    selected_size: label
  });

  sendResponse(twiml, `*${item.name} (${label})*\n\nPrice: ${formatCurrency(price)}\n\nHow many? (Enter number)`, true);
}

async function handleQuantitySelect(from, msg, twiml) {
  const qty = parseInt(msg);
  if (isNaN(qty) || qty <= 0) {
    return sendResponse(twiml, "⚠️ Please enter a valid number (e.g., 2).", true);
  }

  const userSnap = await db.ref(`users/${from}`).once('value');
  const user = userSnap.val();
  const item = userSnap.val().selected_item;
  const price = user.selected_item_price || item.reg;
  const size = user.selected_size || (item.reg === item.ext ? 'Regular' : 'Regular');
  const currentCategory = user.current_category;

  // Logic for Swallows + Free Soup
  if (currentCategory.toLowerCase().includes('swallow')) {
      const tempItem = {
          name: item.name,
          price: price,
          qty: qty,
          size: size,
          type: 'swallow'
      };

      await db.ref(`users/${from}`).update({
          step: 'soup_select',
          temp_swallow_item: tempItem
      });

      let soupList = `🍲 *Select your Free Soup*\n\n`;
      FREE_SOUPS.forEach((s, i) => {
          soupList += `${i + 1}. ${s}\n`;
      });
      soupList += `\nReply number.`;
      sendResponse(twiml, soupList, true);
      return;
  }

  // Standard Item Logic
  const newItem = {
    name: item.name,
    price: price,
    qty: qty,
    size: size,
    type: currentCategory.toLowerCase().includes('protein') ? 'protein' : 'main'
  };

  const cart = user.cart || [];
  cart.push(newItem);

  if (!currentCategory.toLowerCase().includes('protein')) {
    await db.ref(`users/${from}`).update({
      step: 'protein_loop',
      cart: cart
    });
    sendResponse(twiml, `✅ Added ${qty}x ${item.name}.\n\n🍗 Do you want to add Protein/Sides?\n1. Yes\n2. No`, true);
  } else {
    await showCartSummary(from, cart, twiml);
  }
}

// --- NEW: HANDLE SOUP SELECTION ---
async function handleSoupSelect(from, msg, twiml) {
    const userSnap = await db.ref(`users/${from}`).once('value');
    const user = userSnap.val();
    const tempItem = user.temp_swallow_item;

    const soupIndex = parseInt(msg) - 1;
    if (soupIndex < 0 || soupIndex >= FREE_SOUPS.length) {
        return sendResponse(twiml, "Invalid selection. Please reply 1-" + FREE_SOUPS.length, true);
    }

    const selectedSoup = FREE_SOUPS[soupIndex];

    // Update the name with the soup
    const finalItem = {
        ...tempItem,
        name: `${tempItem.name} (${selectedSoup})`
    };

    const cart = user.cart || [];
    cart.push(finalItem);

    // Clear temp and go to protein loop or cart
    await db.ref(`users/${from}`).update({
        step: 'protein_loop',
        cart: cart,
        temp_swallow_item: null
    });

    sendResponse(twiml, `✅ Added ${tempItem.qty}x ${finalItem.name}.\n\n🍗 Do you want to add Protein/Sides?\n1. Yes\n2. No`, true);
}

async function handleProteinLoop(from, msg, twiml) {
  if (msg === '1') {
    const userSnap = await db.ref(`users/${from}`).once('value');
    const user = userSnap.val();
    const vendor = VENDORS.find(v => v.id === user.selected_vendor_id);

    // Fallback to a standard protein category if specific vendor doesn't have one defined
    let proteinCat = vendor.categories["PROTEINS"] || vendor.categories["Proteins"] || vendor.categories["Protein"];

    if (!proteinCat) {
        sendResponse(twiml, "This vendor doesn't have specific protein addons. Going to checkout.", true);
        return showCartSummary(from, userSnap.val().cart, twiml);
    }

    let txt = `🍗 *Proteins & Sides*\n\n`;
    proteinCat.forEach(item => {
       const priceTxt = (item.reg === item.ext) ? formatCurrency(item.reg) : `${formatCurrency(item.reg)} / ${formatCurrency(item.ext)}`;
       txt += `${item.id}. ${item.name} - ${priceTxt}\n`;
    });
    txt += `\nReply item number.`;

    // Find the key for the proteins
    const catKeys = Object.keys(vendor.categories);
    const proteinKey = catKeys.find(k => k.toLowerCase().includes('protein'));

    if(proteinKey) {
        await db.ref(`users/${from}`).update({
            step: 'protein_select',
            current_category: proteinKey
        });
        sendResponse(twiml, txt, true);
    } else {
        await showCartSummary(from, userSnap.val().cart, twiml);
    }

  } else if (msg === '2') {
    const userSnap = await db.ref(`users/${from}`).once('value');
    await showCartSummary(from, userSnap.val().cart, twiml);
  } else {
    sendResponse(twiml, "Reply 1 or 2.", true);
  }
}

async function handleProteinSelect(from, id, twiml) {
  const userSnap = await db.ref(`users/${from}`).once('value');
  const user = userSnap.val();
  const vendor = VENDORS.find(v => v.id === user.selected_vendor_id);

  const cat = vendor.categories[user.current_category];
  if(!cat) return showCartSummary(from, user.cart, twiml); // Fallback

  const item = cat.find(i => i.id === id);
  if (!item) return sendResponse(twiml, "Invalid item.", true);

  await db.ref(`users/${from}`).update({
    step: 'protein_size',
    selected_item: item
  });

  if (item.reg === item.ext) {
    await db.ref(`users/${from}/step`).set('protein_qty');
    sendResponse(twiml, `*${item.name}*\n\nPrice: ${formatCurrency(item.reg)}\n\nHow many pieces?`, true);
  } else {
    sendResponse(twiml, `*${item.name}*\n\n1. Regular (${formatCurrency(item.reg)})\n2. Extra (${formatCurrency(item.ext)})\n\nReply 1 or 2.`, true);
  }
}

async function handleProteinSize(from, msg, twiml) {
  if (msg !== '1' && msg !== '2') return sendResponse(twiml, "Reply 1 or 2.", true);

  const userSnap = await db.ref(`users/${from}`).once('value');
  const item = userSnap.val().selected_item;
  const size = msg === '1' ? 'reg' : 'ext';

  await db.ref(`users/${from}`).update({
    step: 'protein_qty',
    selected_item_price: item[size],
    selected_size: msg === '1' ? 'Regular' : 'Extra'
  });
  sendResponse(twiml, `*${item.name} (${msg === '1' ? 'Regular' : 'Extra'})*\n\nHow many pieces?`, true);
}

async function handleProteinQty(from, msg, twiml) {
    const qty = parseInt(msg);
    if (isNaN(qty) || qty <= 0) return sendResponse(twiml, "⚠️ Please enter a valid number.", true);

  const userSnap = await db.ref(`users/${from}`).once('value');
  const user = userSnap.val();
  const item = userSnap.val().selected_item;

  const newItem = {
    name: item.name,
    price: user.selected_item_price,
    qty: qty,
    size: user.selected_size,
    type: 'protein'
  };

  const cart = user.cart || [];
  cart.push(newItem);

  await db.ref(`users/${from}`).update({ cart: cart, step: 'protein_loop' });
  sendResponse(twiml, `✅ Added ${qty}x ${item.name}.\n\nAdd another protein?\n1. Yes\n2. No (Checkout)`, true);
}

async function showCartSummary(from, cart, twiml) {
  let sub = 0;
  let txt = `🧾 *Current Cart*\n\n`;
  cart.forEach((c) => {
    const t = c.price * c.qty;
    sub += t;
    txt += `${c.name} (${c.size}) x${c.qty} = ${formatCurrency(t)}\n`;
  });
  txt += `\n💰 Subtotal: ${formatCurrency(sub)}\n\n`;
  txt += `Do you want to add another meal?\n1. Yes (Add Food)\n2. No (Proceed to Delivery)`;

  await db.ref(`users/${from}`).update({
    step: 'add_more_or_checkout',
    cart_subtotal: sub
  });
  sendResponse(twiml, txt, true);
}

// --- ERRAND & PICKUP HANDLERS ---

async function handleErrandType(from, type, twiml) {
  let typeStr = "";
  let needsShopping = false;
  let isPickup = false;

  if (type === 1) { typeStr = "MARKET"; needsShopping = true; }
  else if (type === 2) { typeStr = "PICK_UP"; isPickup = true; }
  else if (type === 3) { typeStr = "PHARMACY"; needsShopping = true; }
  else if (type === 4) { typeStr = "TASK"; isPickup = true; }
  else return sendResponse(twiml, "Invalid selection.", true);

  await db.ref(`users/${from}`).update({
    errand_type: typeStr,
    needs_shopping: needsShopping,
    is_pickup: isPickup
  });

  if (isPickup) {
    await db.ref(`users/${from}/step`).set('pickup_description');
    sendResponse(twiml, "📝 *Describe task or pickup details:*\n(e.g., Get a bag of drink at Tarmac)", true);
  } else if (needsShopping) {
    await db.ref(`users/${from}/step`).set('errand_details');
    sendResponse(twiml, `📝 *List the items you want to buy.*\n\nFormat: Item Price, Item Price\nExample: Beans 2000, Oil 500`, true);
  } else {
    await db.ref(`users/${from}/step`).set('pickup_description');
    sendResponse(twiml, "📝 *Describe the task:*", true);
  }
}

async function handleErrandDetails(from, text, twiml) {
  const parts = text.split(',');
  let items = [];
  let budget = 0;

  parts.forEach(p => {
    const subParts = p.trim().split(' ');
    if (subParts.length >= 2) {
      const price = parseInt(subParts.pop());
      const name = subParts.join(' ');
      if (!isNaN(price)) {
        items.push({ name, price });
        budget += price;
      }
    }
  });

  if (items.length === 0) return sendResponse(twiml, "⚠️ Could not read prices. Example: 'Beans 2000'", true);

  await db.ref(`users/${from}`).update({
    step: 'customer_name',
    errand_items: items,
    shopping_budget: budget
  });

  let msg = `✅ Items saved:\n`;
  items.forEach(i => msg += `- ${i.name}: ${formatCurrency(i.price)}\n`);
  msg += `\nTotal Items Cost: ${formatCurrency(budget)}\n\n📝 Next, please provide your Name.`;
  sendResponse(twiml, msg, true);
}

async function handlePickupDescription(from, text, twiml) {
    if (!text || text.trim().length === 0) return sendResponse(twiml, "⚠️ Description cannot be empty.", true);
    await db.ref(`users/${from}`).update({
        step: 'vendor_name',
        errand_description: text
    });
    sendResponse(twiml, "👤 *Who are we picking from?*\n\nPlease provide the Name of the person or shop.", true);
}

async function handleVendorName(from, text, twiml) {
    if (!text || text.trim().length === 0) return sendResponse(twiml, "⚠️ Name cannot be empty.", true);
    await db.ref(`users/${from}`).update({
        step: 'vendor_phone',
        vendor_name: text
    });
    sendResponse(twiml, "📞 *What is their Phone Number?*\n(We need to contact them).", true);
}

async function handleVendorPhone(from, text, twiml) {
    const cleanPhone = text.replace(/\D/g,'');
    if (cleanPhone.length < 10) return sendResponse(twiml, "⚠️ Invalid phone number.", true);

    await db.ref(`users/${from}`).update({
        step: 'customer_name',
        vendor_phone: cleanPhone
    });
    sendResponse(twiml, "👤 *What is YOUR Name?* (Customer Name)", true);
}

// --- GENERAL CHECKOUT FLOW HANDLERS ---

async function handleCustomerName(from, text, twiml) {
    if (!text || text.trim().length === 0) return sendResponse(twiml, "⚠️ Name cannot be empty.", true);
    await db.ref(`users/${from}`).update({
        step: 'customer_phone',
        customer_name: text
    });
    sendResponse(twiml, "📞 Please share YOUR Phone Number (e.g. 08012345678).", true);
}

async function handleCustomerPhone(from, text, twiml) {
    const cleanPhone = text.replace(/\D/g,'');
    if (cleanPhone.length < 10) return sendResponse(twiml, "⚠️ Invalid phone number. Please enter a valid number.", true);

    await db.ref(`users/${from}`).update({
        step: 'delivery_location', // Skip pickup location for food
        customer_phone: cleanPhone
    });

    const userSnap = await db.ref(`users/${from}`).once('value');
    const user = userSnap.val();
    const vendor = VENDORS.find(v => v.id === user.selected_vendor_id);

    if (user.order_type === 'food') {
        // AUTOMATIC PICKUP LOCATION FOR FOOD
        const pickup = vendor ? vendor.address : "Vendor Kitchen";
        await db.ref(`users/${from}`).update({
            pickup_location: pickup
        });
        sendResponse(twiml, `📍 Where should the rider drop the items? (Your Hostel/Room/Address)\n\n(Note: Pickup will be at ${vendor.name})`, true);
    } else {
        // For Errands, we still need pickup location
        await db.ref(`users/${from}`).update({
            step: 'pickup_location'
        });
        sendResponse(twiml, "📍 *Where is the Pickup Location?*\n\n(e.g. Tarmac, School Road, Westend, Safari)", true);
    }
}

async function handlePickupLocation(from, text, twiml) {
    // Only used for Errands now
    if (!text || text.trim().length === 0) return sendResponse(twiml, "⚠️ Location cannot be empty.", true);
    await db.ref(`users/${from}`).update({
        step: 'delivery_location',
        pickup_location: text.trim()
    });
    sendResponse(twiml, "📍 Where should the rider drop the items? (Your Hostel/Room/Address)", true);
}

// ADDED: Handle manual pickup location entry (Currently unused due to auto-food logic, but kept for safety)
async function handlePickupLocationManual(from, text, twiml) {
    if (!text || text.trim().length === 0) return sendResponse(twiml, "⚠️ Address cannot be empty.", true);
    await db.ref(`users/${from}`).update({
        step: 'delivery_location',
        pickup_location: text.trim()
    });
    sendResponse(twiml, "📍 Where should the rider drop the items? (Your Hostel/Room/Address)", true);
}

async function handleDeliveryLocation(from, text, twiml) {
    await db.ref(`users/${from}`).update({
        step: 'confirm_order',
        delivery_location: text
    });
    await generateOrderSummary(from, twiml);
}

async function generateOrderSummary(from, twiml) {
    const userSnap = await db.ref(`users/${from}`).once('value');
    const user = userSnap.val();
    let total = 0;
    let summary = `🧾 *ORDER SUMMARY*\n\n`;

    summary += `👤 Name: ${user.customer_name}\n`;
    summary += `📞 Phone: ${user.customer_phone}\n\n`;

    if (user.vendor_name) {
        summary += `🏪 Pickup From: ${user.vendor_name}\n`;
        summary += `📞 Vendor Phone: ${user.vendor_phone}\n\n`;
    }

    if (user.order_type === 'food') {
        total = user.cart_subtotal || 0;
        user.cart.forEach(c => {
            summary += `${c.name} (${c.size}) x${c.qty}\n`;
        });
        summary += `\nFood Cost: ${formatCurrency(total)}`;
    } else {
        if (user.errand_items && user.errand_items.length > 0) {
            total = user.shopping_budget || 0;
            summary += `Items:\n`;
            user.errand_items.forEach(i => summary += `- ${i.name}\n`);
            summary += `\nItems Cost: ${formatCurrency(total)}`;
            if (user.needs_shopping) summary += `\nShopping Fee: ${formatCurrency(SHOPPING_FEE)}`;
            total += SHOPPING_FEE;
        } else {
            summary += `Task/Details: ${user.errand_description}\n`;
            total = SHOPPING_FEE;
            summary += `\nService Fee: ${formatCurrency(SHOPPING_FEE)}`;
        }
    }

    total += DELIVERY_FEE;
    summary += `\n📍 Pickup: ${user.pickup_location}`;
    summary += `\n🏠 Delivery: ${user.delivery_location}`;
    summary += `\n🚚 Delivery Fee: ${formatCurrency(DELIVERY_FEE)}`;
    summary += `\n━━━━━━━━━━━\n💰 *TOTAL: ${formatCurrency(total)}*`;

    await db.ref(`users/${from}`).update({ final_total: total });

    summary += `\n\nReply "CONFIRM" to proceed to payment.`;
    sendResponse(twiml, summary, true);
}

async function handleFinalConfirm(from, msg, twiml) {
  if (msg !== 'confirm') return sendResponse(twiml, "Please type CONFIRM to proceed.", true);

  const userSnap = await db.ref(`users/${from}`).once('value');
  const user = userSnap.val();

  await db.ref(`users/${from}`).update({
    step: 'awaiting_payment'
  });

  // NO INSTRUCTIONS ON PAYMENT SCREEN
  twiml.message(`💳 *Payment Details*\n\nPlease pay ${formatCurrency(user.final_total)} to:\n\n🏦 *Bank:* Monie Point\n👤 *Name:* ChowZone Dev\n🔢 *Acct:* 70437763589\n\n📸 *Send a screenshot of the receipt here to complete your order.*`);
}

// --- 8. ADMIN & ORDER LOGIC ---

async function createOrderInDB(from, user, twiml, mediaUrl) {
  const orderId = generateId();
  const total = user.final_total;

  let orderDetails = [];
  if (user.order_type === 'food') {
      orderDetails = user.cart;
  } else if (user.errand_items) {
      orderDetails = user.errand_items;
  } else {
      orderDetails = [{ name: user.errand_description || "Errand Task", price: 0 }];
  }

  const orderData = {
    id: orderId,
    customer: from,
    customer_name: user.customer_name,
    customer_phone: user.customer_phone,
    type: user.order_type,
    status: 'pending_payment',
    total: total,
    delivery_loc: user.delivery_location,
    pickup_loc: user.pickup_location,
    details: orderDetails,
    vendor_name: user.vendor_name || null,
    vendor_phone: user.vendor_phone || null,
    timestamp: admin.database.ServerValue.TIMESTAMP
  };

  await db.ref(`orders/${orderId}`).set(orderData);

  await db.ref(`users/${from}`).update({
      step: 'new', // Reset step so user can't add more items, but keep order_id
      last_order_id: orderId
  });

  twiml.message(`✅ *Order Received!*\n\nYour Order #${orderId} is worth ${formatCurrency(total)}.\n\nWe are verifying your payment now. You will be notified shortly.`);

  try {
    // DEBUG: Print numbers to console
    const adminPhone = formatWhatsappNumber(ADMIN_PHONE);
    console.log(`[DEBUG] Sending to Admin: ${adminPhone} | From: ${SANDBOX_NUMBER}`);

    let itemsList = "";
    if (user.order_type === 'food') {
      user.cart.forEach(c => itemsList += `- ${c.name} (${c.size}) x${c.qty}\n`);
    } else {
      if (user.errand_items) {
          user.errand_items.forEach(i => itemsList += `- ${i.name}\n`);
      } else {
          itemsList += `- ${user.errand_description}\n`;
      }
    }

    let vendorInfo = "";
    if (user.vendor_name) {
        vendorInfo = `\n🏪 Vendor: ${user.vendor_name}\n📞 Vendor Phone: ${user.vendor_phone}\n`;
    }

    const adminMsg = `💳 *NEW PAYMENT ALERT*\n\n` +
                    `Order ID: #${orderId}\n` +
                    `Type: ${user.order_type.toUpperCase()}\n` +
                    `Customer: ${user.customer_name}\n` +
                    `Phone: ${user.customer_phone}\n` +
                    `Pickup: ${user.pickup_location}\n` +
                    `Delivery: ${user.delivery_location}\n` +
                    `Total: ${formatCurrency(total)}\n\n` +
                    `Items:\n${itemsList}` +
                    `${vendorInfo}` +
                    `\n[Check WhatsApp for Screenshot]`;

    const messageOptions = {
      from: SANDBOX_NUMBER, // HARDCODED SANDBOX SENDER
      to: adminPhone,      // FORMATTED ADMIN NUMBER
      body: adminMsg
    };

    if (mediaUrl) {
      messageOptions.mediaUrl = [mediaUrl];
    }

    await client.messages.create(messageOptions);
    console.log(`[DEBUG] Admin message sent successfully.`);

  } catch (err) {
    console.error("Failed to send Admin notification:", err);
  }
}

async function approveOrder(orderId) {
  const snap = await db.ref(`orders/${orderId}`).once('value');
  const order = snap.val();
  if (!order) return;

  await db.ref(`orders/${orderId}/status`).set('seeking_rider');

  await client.messages.create({
    from: SANDBOX_NUMBER,
    to: order.customer,
    body: `✅ *Payment Verified*\n\nYour Order #${orderId} has been placed! We are assigning a rider now.`
  });

  broadcastToRiders(orderId, order);
}

async function rejectOrder(orderId) {
  const snap = await db.ref(`orders/${orderId}`).once('value');
  const order = snap.val();
  if (!order) return;

  await db.ref(`orders/${orderId}/status`).set('rejected');

  await client.messages.create({
    from: SANDBOX_NUMBER,
    to: order.customer,
    body: `❌ *Payment Not Found*\n\nWe could not verify your payment for Order #${orderId}. Please contact Admin or try again.`
  });
}

async function acceptOrder(riderPhone, orderId, twiml) {
  const snap = await db.ref(`orders/${orderId}`).once('value');
  const order = snap.val();

  if (order.status !== 'seeking_rider') return twiml.message("Job already taken or closed.");

  const riderSnap = await db.ref(`riders/${riderPhone}`).once('value');
  const rider = riderSnap.val();

  await db.ref(`orders/${orderId}`).update({
    status: 'rider_accepted',
    rider_phone: riderPhone,
    rider_name: rider.name
  });

  twiml.message(`✅ You have accepted Order #${orderId}. Wait for Admin to contact you regarding payment details.`);

  const adminPhone = formatWhatsappNumber(ADMIN_PHONE);

  const adminMsg = `🛵 *RIDER ACCEPTED JOB*\n\n` +
                  `Order #${orderId}\n` +
                  `Rider Name: ${rider.name}\n` +
                  `Rider Phone: ${riderPhone}\n\n` +
                  `Please contact rider to arrange details and send the order payment to his account manually.`;

  await client.messages.create({
    from: SANDBOX_NUMBER,
    to: adminPhone,
    body: adminMsg
  });

  await client.messages.create({
    from: SANDBOX_NUMBER,
    to: order.customer,
    body: `🛵 *Rider Assigned*\n\nOrder #${orderId}\nRider Name: ${rider.name}\nRider Phone: ${riderPhone}\n\nExpect delivery shortly.`
  });
}

async function updateOrderStatus(orderId, status, twiml, from) {
  const snap = await db.ref(`orders/${orderId}`).once('value');
  const order = snap.val();
  if (order.rider_phone !== from) return twiml.message("Not your order.");

  await db.ref(`orders/${orderId}/status`).set(status);

  if (status === 'delivered') {
    await db.ref(`users/${order.customer}`).update({ step: 'rate_rider' });

    await client.messages.create({
      from: SANDBOX_NUMBER,
      to: order.customer,
      body: `✅ *Order Delivered!*\n\nOrder #${orderId} is complete.\n\nPlease rate your Rider (1-5 stars):`
    });

    twiml.message(`✅ Order #${orderId} marked as Delivered. Good job!`);
  }
}

// --- RATING HANDLERS ---
async function handleRateRider(from, msg, twiml) {
    const rating = parseInt(msg);
    if (isNaN(rating) || rating < 1 || rating > 5) {
        return sendResponse(twiml, "Please enter a number between 1 and 5.", true);
    }
    const userSnap = await db.ref(`users/${from}`).once('value');
    const user = userSnap.val();
    const orderId = user.last_order_id;
    await db.ref(`orders/${orderId}/rating/rider`).set(rating);
    await db.ref(`users/${from}`).update({ step: 'rate_service' });
    sendResponse(twiml, `Thanks! How would you rate ChowZone service? (1-5 stars)`, true);
}

async function handleRateService(from, msg, twiml) {
    const rating = parseInt(msg);
    if (isNaN(rating) || rating < 1 || rating > 5) {
        return sendResponse(twiml, "Please enter a number between 1 and 5.", true);
    }
    const userSnap = await db.ref(`users/${from}`).once('value');
    const user = userSnap.val();
    const orderId = user.last_order_id;
    await db.ref(`orders/${orderId}/rating/service`).set(rating);
    await db.ref(`users/${from}`).update({ step: 'new' });
    twiml.message(`Thank you for your feedback! We hope to see you again soon. 🍽️`);
}

async function broadcastToRiders(orderId, order) {
  const ridersSnap = await db.ref('riders').orderByChild('status').equalTo('on_duty').once('value');
  const riders = ridersSnap.val();

  let itemsSummary = "";
  if (order.type === 'food') {
      order.details.forEach(d => itemsSummary += `${d.name} x${d.qty}, `);
      itemsSummary = itemsSummary.slice(0, -2);
  } else {
      itemsSummary = order.details[0].name;
  }

  let msg = `🛵 NEW JOB #${orderId}\n`;
  msg += `Customer: ${order.customer_name}\n`;
  msg += `Phone: ${order.customer_phone}\n`;

  if (order.vendor_name) {
      msg += `Picking from: ${order.vendor_name} (${order.vendor_phone})\n`;
  }

  msg += `Pickup: ${order.pickup_loc}\n`;
  msg += `Dropoff: ${order.delivery_loc}\n`;
  msg += `Items: ${itemsSummary}\n`;
  msg += `Total Value: ${formatCurrency(order.total)}\n`;
  msg += `Delivery Fee: ${formatCurrency(DELIVERY_FEE)}\n`;
  msg += `\nReply: ACCEPT ${orderId}`;

  if (riders) {
    Object.keys(riders).forEach(key => {
      const rider = riders[key];
      if (rider.phone) {
        client.messages.create({
          from: SANDBOX_NUMBER,
          to: formatWhatsappNumber(rider.phone),
          body: msg
        }).then(message => console.log(message.sid))
        .catch(err => console.error(err));
      }
    });
  }
}

// --- 9. LISTEN ---
app.get('/', (req, res) => res.send('ChowZone Bot is Active'));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
