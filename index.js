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

// --- 4. VENDORS DATABASE ---
// Logic: 1 Price = Same for Reg/Ext. 2 Prices = Reg/Ext. 
// "S/M/L" converted to separate items.
const VENDORS = {
  1: {
    name: "Tee Jay Frozen Food",
    menu: {
      "FISH PER KILO": [
        { id: 101, name: "Shawa", reg: 3400, ext: 3400 },
        { id: 102, name: "Titus", reg: 7000, ext: 7000 },
        { id: 103, name: "Hake", reg: 5200, ext: 5200 },
        { id: 104, name: "Kote", reg: 4000, ext: 4000 },
        { id: 105, name: "Croacker", reg: 6000, ext: 6000 },
        { id: 106, name: "Snail", reg: 7000, ext: 7000 },
        { id: 107, name: "Cheese", reg: 4000, ext: 4000 },
        { id: 108, name: "Chicken Lap", reg: 6000, ext: 6000 }
      ],
      "TURKEY PER KILO": [
        { id: 109, name: "Wings", reg: 9999, ext: 9999 },
        { id: 110, name: "Finger", reg: 7000, ext: 7000 },
        { id: 111, name: "Blanket", reg: 0, ext: 0 },
        { id: 112, name: "Chicken Filet", reg: 6200, ext: 6200 }
      ],
      "CHICKEN PER KILO": [
        { id: 113, name: "Chicken", reg: 4600, ext: 4600 },
        { id: 114, name: "Gizzard", reg: 5200, ext: 5200 },
        { id: 115, name: "Leg and head", reg: 2200, ext: 2200 },
        { id: 116, name: "Neck of Chicken", reg: 2500, ext: 2500 },
        { id: 117, name: "Wings", reg: 6000, ext: 6000 },
        { id: 118, name: "Chicken Breast", reg: 5000, ext: 5000 }
      ],
      "OTHERS": [
        { id: 119, name: "Susages", reg: 2600, ext: 2600 },
        { id: 120, name: "Sharwama Bread", reg: 1300, ext: 1300 },
        { id: 121, name: "Chips/Fries", reg: 4500, ext: 4500 },
        { id: 122, name: "Shrimps", reg: 13000, ext: 13000 },
        { id: 123, name: "Crabs", reg: 6000, ext: 6000 }
      ]
    }
  },
  2: {
    name: "Biggy’s Shack Sharwama",
    menu: {
      "SHAWARMA": [
        { id: 201, name: "Double sausage chicken", reg: 3000, ext: 3000 },
        { id: 202, name: "Double sausage extra chicken", reg: 3500, ext: 3500 },
        { id: 203, name: "Double sausage chicken/suya", reg: 4000, ext: 4000 },
        { id: 204, name: "Double Sausage Suya filled", reg: 4000, ext: 4000 },
        { id: 205, name: "Combo Extra chicken/ Suya", reg: 4500, ext: 4500 },
        { id: 206, name: "Breadwarma", reg: 6000, ext: 6000 },
        { id: 207, name: "BIG MEN SIZE shawarma", reg: 8000, ext: 8000 },
        { id: 208, name: "Chicken and chips", reg: 5000, ext: 5000 },
        { id: 209, name: "Friens Combo", reg: 7500, ext: 7500 }
      ]
    }
  },
  3: {
    name: "Zrof Pharmacy",
    menu: {
      "PHARMACY": [
        { id: 301, name: "Postinor 2", reg: 2500, ext: 2500 },
        { id: 302, name: "Post pill", reg: 2500, ext: 2500 },
        { id: 303, name: "Evening primrose oil", reg: 13200, ext: 13200 },
        { id: 304, name: "Back-up", reg: 2000, ext: 2000 },
        { id: 305, name: "Well roze capsules", reg: 6200, ext: 6200 },
        { id: 306, name: "Amatem softgel forte", reg: 3000, ext: 3000 },
        { id: 307, name: "Lonart -DS", reg: 3700, ext: 3700 },
        { id: 308, name: "Mureql tablet", reg: 1700, ext: 1700 },
        { id: 309, name: "Omega -H3 bio-tonic", reg: 3000, ext: 3000 },
        { id: 310, name: "Obron -6 plus iron", reg: 1500, ext: 1500 },
        { id: 311, name: "P-alaxin", reg: 2000, ext: 2000 },
        { id: 312, name: "Artequick", reg: 6000, ext: 6000 },
        { id: 313, name: "Co-mal tablets", reg: 1000, ext: 1000 },
        { id: 314, name: "Feroglobin b12", reg: 5800, ext: 5800 },
        { id: 315, name: "Strepsils intensive", reg: 3000, ext: 3000 },
        { id: 316, name: "Sirop dynewell plus", reg: 7500, ext: 7500 },
        { id: 317, name: "Dynewell", reg: 4200, ext: 4200 },
        { id: 318, name: "De-deon -5 sirop", reg: 3500, ext: 3500 },
        { id: 319, name: "Apetadine syrup", reg: 2000, ext: 2000 },
        { id: 320, name: "Astymin/Astyfer", reg: 4500, ext: 4500 },
        { id: 321, name: "Avro/Gold apetit syrup", reg: 1500, ext: 1500 },
        { id: 322, name: "Kiss", reg: 550, ext: 550 },
        { id: 323, name: "Gold circle", reg: 500, ext: 500 },
        { id: 324, name: "Durex feels", reg: 1500, ext: 1500 }
      ]
    }
  },
  4: {
    name: "YK Noodles",
    menu: {
      "MAIN COURSE": [
        { id: 401, name: "Royal", reg: 7950, ext: 7950 },
        { id: 402, name: "Tropicana", reg: 7150, ext: 7150 },
        { id: 403, name: "Turkit top", reg: 6650, ext: 6650 },
        { id: 404, name: "Relish", reg: 5850, ext: 5850 },
        { id: 405, name: "Sea mix", reg: 3950, ext: 3950 },
        { id: 406, name: "Delight", reg: 3150, ext: 3150 },
        { id: 407, name: "Banger", reg: 2650, ext: 2650 },
        { id: 408, name: "Classic", reg: 1850, ext: 1850 },
        { id: 409, name: "Plantain Platter", reg: 0, ext: 0 }
      ]
    }
  },
  5: {
    name: "Big Mummy’s Kitchen",
    menu: {
      "MEALS": [
        { id: 501, name: "Small plate with chicken", reg: 2500, ext: 2500 },
        { id: 502, name: "Big plate with chicken", reg: 3000, ext: 3000 },
        { id: 503, name: "Extra chicken", reg: 1000, ext: 1000 },
        { id: 504, name: "Small plate meat and Egg", reg: 2000, ext: 2000 },
        { id: 505, name: "Extra meat", reg: 300, ext: 300 },
        { id: 506, name: "Extra Egg", reg: 300, ext: 300 }
      ]
    }
  },
  6: {
    name: "Deemeallab – Food Menu",
    menu: {
      "EVERYDAY MEAL": [
        { id: 601, name: "Spaghetti & Sauce", reg: 2000, ext: 2000 },
        { id: 602, name: "Special Fried Rice", reg: 4000, ext: 4000 },
        { id: 603, name: "Fried Rice", reg: 1500, ext: 1500 },
        { id: 604, name: "Eba & Egusi", reg: 1800, ext: 1800 },
        { id: 605, name: "White Rice & Beans", reg: 1700, ext: 1700 },
        { id: 606, name: "Yam Porridge", reg: 1500, ext: 1500 },
        { id: 607, name: "White Rice & Sauce", reg: 1500, ext: 1500 },
        { id: 608, name: "White Rice", reg: 1000, ext: 1000 },
        { id: 609, name: "Plantain", reg: 500, ext: 500 },
        { id: 610, name: "Coleslaw", reg: 1500, ext: 1500 },
        { id: 611, name: "Bread", reg: 1200, ext: 1200 },
        { id: 612, name: "Samosa / Chops", reg: 1500, ext: 1500 },
        { id: 613, name: "Noodles", reg: 1500, ext: 1500 }
      ],
      "MONDAY SPECIAL": [
        { id: 614, name: "Catfish Stew", reg: 2000, ext: 2000 },
        { id: 615, name: "Toast Bread + Coffee", reg: 3500, ext: 3500 },
        { id: 616, name: "Tapioca (Milk & Sugar)", reg: 3000, ext: 3000 },
        { id: 617, name: "Efo Riro / Swallow", reg: 2500, ext: 2500 },
        { id: 618, name: "Moi Moi", reg: 3000, ext: 3000 }
      ],
      "PROTEINS": [
        { id: 619, name: "Chicken Wings", reg: 2500, ext: 2500 },
        { id: 620, name: "Beef", reg: 1000, ext: 1000 }, // Using base price
        { id: 621, name: "Assorted", reg: 1000, ext: 1000 },
        { id: 622, name: "Ponmo", reg: 1000, ext: 1000 },
        { id: 623, name: "Kote Fish", reg: 1000, ext: 1000 },
        { id: 624, name: "Panla", reg: 1000, ext: 1000 },
        { id: 625, name: "Egg", reg: 500, ext: 500 },
        { id: 626, name: "Titus Fish", reg: 2500, ext: 2500 },
        { id: 627, name: "Snail", reg: 2500, ext: 2500 },
        { id: 628, name: "Chicken", reg: 2500, ext: 2500 },
        { id: 629, name: "Turkey", reg: 4500, ext: 4500 },
        { id: 630, name: "Gizzard", reg: 1000, ext: 1000 },
        { id: 631, name: "Catfish", reg: 2500, ext: 2500 },
        { id: 632, name: "Smoked Catfish", reg: 2500, ext: 2500 },
        { id: 633, name: "Goat Meat", reg: 2500, ext: 2500 }
      ]
    }
  },
  7: {
    name: "Savoré by Adebayo",
    menu: {
      "SMALL PLATES": [
        { id: 701, name: "Fried Rice & Jollof (Chicken)", reg: 3000, ext: 3000 },
        { id: 702, name: "Fried Rice & Jollof (Turkey)", reg: 4000, ext: 4000 },
        { id: 703, name: "Jollof Only (Chicken)", reg: 3000, ext: 3000 },
        { id: 704, name: "Jollof Only (Turkey)", reg: 4000, ext: 4000 },
        { id: 705, name: "Stir-fry Rice (Chicken)", reg: 3000, ext: 3000 },
        { id: 706, name: "Stir-fry Rice (Turkey)", reg: 4000, ext: 4000 },
        { id: 707, name: "Stir-fried Spaghetti (Chicken)", reg: 3200, ext: 3200 },
        { id: 708, name: "Stir-fried Spaghetti (Turkey)", reg: 4200, ext: 4200 }
      ],
      "BIG PLATES": [
        { id: 709, name: "Fried Rice & Jollof (Chicken)", reg: 4000, ext: 4000 },
        { id: 710, name: "Fried Rice & Jollof (Turkey)", reg: 5500, ext: 5500 },
        { id: 711, name: "Jollof Only (Chicken)", reg: 4000, ext: 4000 },
        { id: 712, name: "Jollof Only (Turkey)", reg: 5500, ext: 5500 },
        { id: 713, name: "Stir-fry Rice (Chicken)", reg: 4000, ext: 4000 },
        { id: 714, name: "Stir-fry Rice (Turkey)", reg: 5500, ext: 5500 },
        { id: 715, name: "Stir-fried Spaghetti (Chicken)", reg: 4200, ext: 4200 },
        { id: 716, name: "Stir-fried Spaghetti (Turkey)", reg: 5700, ext: 5700 }
      ],
      "EXTRAS": [
        { id: 717, name: "Plantain", reg: 500, ext: 500 },
        { id: 718, name: "Coleslaw", reg: 500, ext: 500 },
        { id: 719, name: "Extra Chicken", reg: 1500, ext: 1500 },
        { id: 720, name: "Extra Turkey", reg: 3000, ext: 3000 }
      ],
      "BENTO CAKES": [
        { id: 721, name: "Basic Bento", reg: 8500, ext: 8500 },
        { id: 722, name: "Whipped Cream Bento", reg: 10000, ext: 10000 }
      ]
    }
  },
  8: {
    name: "Royal Chaw spot",
    menu: {
      "SHARWARMA": [
        { id: 801, name: "Without sausage", reg: 2000, ext: 2000 },
        { id: 802, name: "Single sausage", reg: 2500, ext: 2500 },
        { id: 803, name: "Double sausage", reg: 3000, ext: 3000 },
        { id: 804, name: "Royal special", reg: 4000, ext: 4000 },
        { id: 805, name: "Chessy sharwama", reg: 4000, ext: 4000 }
      ],
      "BURGER": [
        { id: 806, name: "Single chicken", reg: 5000, ext: 5000 },
        { id: 807, name: "Double chicken", reg: 6000, ext: 6000 }
      ],
      "FRIES": [
        { id: 808, name: "Loaded fries", reg: 5000, ext: 5000 },
        { id: 809, name: "Loaded fries with cheese", reg: 6000, ext: 6000 },
        { id: 810, name: "Chicken and fried", reg: 5000, ext: 5000 },
        { id: 811, name: "Extra chicken", reg: 1500, ext: 1500 },
        { id: 812, name: "Extra fries", reg: 1000, ext: 1000 }
      ],
      "BREAD SHARWARMA": [
        { id: 813, name: "Without sausage", reg: 2000, ext: 2000 },
        { id: 814, name: "Single sausage", reg: 2500, ext: 2500 },
        { id: 815, name: "Double sausage", reg: 3000, ext: 3000 },
        { id: 816, name: "Jumbo bread sharwama", reg: 3500, ext: 3500 }
      ],
      "SIDES": [
        { id: 817, name: "Sandwich", reg: 700, ext: 700 },
        { id: 818, name: "Royal pizza", reg: 10000, ext: 10000 }
      ],
      "BARBECUE": [
        { id: 819, name: "Small size", reg: 4000, ext: 4000 },
        { id: 820, name: "Medium", reg: 5000, ext: 5000 },
        { id: 821, name: "Large", reg: 6500, ext: 6500 }
      ],
      "NKWOBI": [
        { id: 822, name: "Small size", reg: 4000, ext: 4000 },
        { id: 823, name: "Large size", reg: 6000, ext: 6000 }
      ]
    }
  },
  9: {
    name: "Hot oole",
    menu: {
      "MOI MOI": [
        { id: 901, name: "Special combo moi moi", reg: 1500, ext: 1500 },
        { id: 902, name: "Moi moi with Egg", reg: 700, ext: 700 },
        { id: 903, name: "Moi moi (plain)", reg: 400, ext: 400 },
        { id: 904, name: "Moi moi with fish", reg: 600, ext: 600 }
      ],
      "TAPIOCA & FURA": [
        { id: 905, name: "Tapioca (small bowl)", reg: 1200, ext: 1200 },
        { id: 906, name: "Tapioca (big bowl)", reg: 1500, ext: 1500 },
        { id: 907, name: "Fura(small bowl)", reg: 1200, ext: 1200 },
        { id: 908, name: "Fura (big bowl)", reg: 1500, ext: 1500 }
      ],
      "EXTRAS": [
        { id: 909, name: "Extra milk", reg: 300, ext: 300 },
        { id: 910, name: "Kunu", reg: 1000, ext: 1000 },
        { id: 911, name: "Zobo", reg: 1000, ext: 1000 }
      ],
      "COMBO": [
        { id: 912, name: "Pap and milk with moi moi", reg: 3000, ext: 3000 },
        { id: 913, name: "Tapioca and milk and moi moi", reg: 3000, ext: 3000 }
      ]
    }
  },
  10: {
    name: "WRAP STAR MENU",
    menu: {
      "SHARWARMA": [
        { id: 1001, name: "Chicken alone", reg: 2500, ext: 2500 },
        { id: 1002, name: "Beef alone", reg: 2800, ext: 2800 },
        { id: 1003, name: "Single sausage", reg: 2700, ext: 2700 },
        { id: 1004, name: "Double sausage", reg: 3000, ext: 3000 },
        { id: 1005, name: "Chicken & beef", reg: 3000, ext: 3000 },
        { id: 1006, name: "Chicken, Beef & A sausage", reg: 3500, ext: 3500 },
        { id: 1007, name: "Chicken,Beef & 2 sausage", reg: 3800, ext: 3800 },
        { id: 1008, name: "Sharwama special", reg: 4500, ext: 4500 }
      ],
      "BURGER": [
        { id: 1009, name: "Single chicken", reg: 4500, ext: 4500 },
        { id: 1010, name: "Double chicken", reg: 5000, ext: 5000 },
        { id: 1011, name: "Beef suya", reg: 4500, ext: 4500 }
      ],
      "FRIES": [
        { id: 1012, name: "Fries &chicken", reg: 5500, ext: 5500 },
        { id: 1013, name: "Beef kebab", reg: 2000, ext: 2000 },
        { id: 1014, name: "Kebab & FRIES", reg: 4500, ext: 4500 },
        { id: 1015, name: "FRIES combo", reg: 7000, ext: 7000 },
        { id: 1016, name: "Loaded fries", reg: 6000, ext: 6000 }
      ]
    }
  },
  11: {
    name: "CHAO COCINA",
    menu: {
      "STIRFRY SPAGHETTI": [
        { id: 1101, name: "Large with turkey", reg: 3800, ext: 3800 },
        { id: 1102, name: "Medium with turkey", reg: 3300, ext: 3300 },
        { id: 1103, name: "Large with asun", reg: 3300, ext: 3300 },
        { id: 1104, name: "Medium with asun", reg: 3000, ext: 3000 },
        { id: 1105, name: "Extra/only turkey", reg: 2800, ext: 2800 },
        { id: 1106, name: "Extra/only asun", reg: 2000, ext: 2000 },
        { id: 1107, name: "Extra stirfry", reg: 1000, ext: 1000 },
        { id: 1108, name: "Extra sausage", reg: 400, ext: 400 }
      ],
      "POTATO FRIES": [
        { id: 1109, name: "Fries&turkey", reg: 5500, ext: 5500 },
        { id: 1110, name: "Fries &Asun", reg: 5000, ext: 5000 },
        { id: 1111, name: "Plantain per portion", reg: 500, ext: 500 },
        { id: 1112, name: "Ketchup", reg: 300, ext: 300 }
      ],
      "DRINKS": [
        { id: 1113, name: "Bottle water", reg: 300, ext: 300 },
        { id: 1114, name: "Soft drinks", reg: 500, ext: 500 },
        { id: 1115, name: "Fearless", reg: 600, ext: 600 },
        { id: 1116, name: "Malt", reg: 600, ext: 600 },
        { id: 1117, name: "Fayrouz", reg: 800, ext: 800 },
        { id: 1118, name: "Chivita active", reg: 800, ext: 800 }
      ]
    }
  },
  12: {
    name: "KRAFTY KITCHEN",
    menu: {
      "FOOD MENU": [
        { id: 1201, name: "Small plate with chicken", reg: 2500, ext: 2500 },
        { id: 1202, name: "Big plate with chicken", reg: 3000, ext: 3000 },
        { id: 1203, name: "Plantain", reg: 500, ext: 500 },
        { id: 1204, name: "Coleslaw", reg: 500, ext: 500 },
        { id: 1205, name: "Extra chicken", reg: 2000, ext: 2000 },
        { id: 1206, name: "Ofada Rice with chicken,egg & assorted", reg: 4500, ext: 4500 },
        { id: 1207, name: "Krafty fruit parfait (Big cup)", reg: 4000, ext: 4000 },
        { id: 1208, name: "Krafty fruit parfait (small cup)", reg: 3500, ext: 3500 },
        { id: 1209, name: "Fish barbecue", reg: 3000, ext: 3000 },
        { id: 1210, name: "Big plate of pasta with chicken", reg: 3500, ext: 3500 },
        { id: 1211, name: "Small plate of pasta with chicken", reg: 3000, ext: 3000 },
        { id: 1212, name: "Big plate of pasta with beef", reg: 2700, ext: 2700 },
        { id: 1213, name: "Small plate of pasta with beef", reg: 2200, ext: 2200 },
        { id: 1214, name: "Small plate of rice with beef", reg: 1700, ext: 1700 },
        { id: 1215, name: "Big plate of rice with beef", reg: 2200, ext: 2200 },
        { id: 1216, name: "Beef", reg: 500, ext: 500 },
        { id: 1217, name: "Egg", reg: 400, ext: 400 }
      ],
      "DRINKS": [
        { id: 1218, name: "Viju milk", reg: 700, ext: 700 },
        { id: 1219, name: "Coke", reg: 500, ext: 500 },
        { id: 1220, name: "Fanta", reg: 500, ext: 500 },
        { id: 1221, name: "Bottle water", reg: 250, ext: 250 },
        { id: 1222, name: "Pepsi", reg: 500, ext: 500 },
        { id: 1223, name: "Predator", reg: 600, ext: 600 },
        { id: 1224, name: "Fearless", reg: 600, ext: 600 },
        { id: 1225, name: "Zobo", reg: 800, ext: 800 },
        { id: 1226, name: "Exotic", reg: 800, ext: 800 },
        { id: 1227, name: "Active can", reg: 800, ext: 800 },
        { id: 1228, name: "Exotic Big", reg: 1800, ext: 1800 },
        { id: 1229, name: "Monster", reg: 1500, ext: 1500 },
        { id: 1230, name: "Berry blast", reg: 1500, ext: 1500 },
        { id: 1231, name: "Puppy orange", reg: 1500, ext: 1500 },
        { id: 1232, name: "Nutri milk", reg: 700, ext: 700 }
      ],
      "KRAFTY SHARWARMA": [
        { id: 1233, name: "Sharwama without sausage", reg: 2000, ext: 2000 },
        { id: 1234, name: "Chicken sharwama", reg: 2500, ext: 2500 },
        { id: 1235, name: "Beef sharwama", reg: 2500, ext: 2500 },
        { id: 1236, name: "Sharwama combo", reg: 3000, ext: 3000 },
        { id: 1237, name: "Sharwama & single sausage", reg: 2500, ext: 2500 },
        { id: 1238, name: "Sharwama & Double sausage", reg: 3000, ext: 3000 },
        { id: 1239, name: "Special sharwama with a free drink", reg: 4000, ext: 4000 }
      ]
    }
  },
  13: {
    name: "SPAG CITY MENU",
    menu: {
      "MEALS": [
        { id: 1301, name: "Spag & Big Tutkey", reg: 6500, ext: 6500 },
        { id: 1302, name: "Spag & mid turkey", reg: 4000, ext: 4000 },
        { id: 1303, name: "Spag & chicken", reg: 3600, ext: 3600 }
      ],
      "SIDES": [
        { id: 1304, name: "Sharwama single sausage", reg: 2500, ext: 2500 },
        { id: 1305, name: "Double sausage", reg: 3000, ext: 3000 },
        { id: 1306, name: "Sausage", reg: 500, ext: 500 },
        { id: 1307, name: "Plantain", reg: 500, ext: 500 },
        { id: 1308, name: "Coleslaw", reg: 500, ext: 500 },
        { id: 1309, name: "Asun", reg: 2000, ext: 2000 }
      ]
    }
  },
  14: {
    name: "HD TREATS",
    menu: {
      "BURGER": [
        { id: 1401, name: "Single Chicken", reg: 5000, ext: 5000 },
        { id: 1402, name: "Double Chicken", reg: 7000, ext: 7000 },
        { id: 1403, name: "Single Beef", reg: 5000, ext: 5000 },
        { id: 1404, name: "Double Beef", reg: 7000, ext: 7000 }
      ],
      "SHAWARMA": [
        { id: 1405, name: "Beef", reg: 3500, ext: 3500 },
        { id: 1406, name: "Chicken", reg: 3500, ext: 3500 },
        { id: 1407, name: "Jumbo", reg: 5000, ext: 5000 },
        { id: 1408, name: "Extra Sausage", reg: 500, ext: 500 },
        { id: 1409, name: "Extra Chicken", reg: 500, ext: 500 }
      ],
      "SANDWICH": [
        { id: 1410, name: "Club Chicken", reg: 3500, ext: 3500 },
        { id: 1411, name: "Club Beef", reg: 3500, ext: 3500 },
        { id: 1412, name: "Philly Cheese Steak", reg: 7000, ext: 7000 },
        { id: 1413, name: "Chicken Cheese Melt", reg: 7000, ext: 7000 }
      ],
      "BEVERAGES": [
        { id: 1414, name: "Fruity Zobo", reg: 1500, ext: 1500 },
        { id: 1415, name: "Pineapple Juice", reg: 2500, ext: 2500 },
        { id: 1416, name: "Watermelon Juice", reg: 2500, ext: 2500 },
        { id: 1417, name: "Creamy Yoghurt", reg: 2500, ext: 2500 }
      ],
      "PARFAIT": [
        { id: 1418, name: "Yoghurt Parfait (500ml)", reg: 6500, ext: 6500 },
        { id: 1419, name: "Yoghurt Parfait (1 litre)", reg: 12500, ext: 12500 },
        { id: 1420, name: "Greek Yoghurt (500ml)", reg: 5000, ext: 5000 },
        { id: 1421, name: "Greek Yoghurt (1 litre)", reg: 9500, ext: 9500 },
        { id: 1422, name: "Vanilla Milkshake", reg: 7000, ext: 7000 },
        { id: 1423, name: "Oreo Milkshake", reg: 7000, ext: 7000 },
        { id: 1424, name: "Strawberry Milkshake", reg: 7000, ext: 7000 },
        { id: 1425, name: "Banana Milkshake", reg: 7000, ext: 7000 }
      ],
      "PIZZA PACKAGES": [
        { id: 1426, name: "Beef Pizza (Small)", reg: 6000, ext: 6000 },
        { id: 1427, name: "Beef Pizza (Medium)", reg: 8000, ext: 8000 },
        { id: 1428, name: "Beef Pizza (Large)", reg: 10000, ext: 10000 },
        { id: 1429, name: "Chicken Pizza (Small)", reg: 6000, ext: 6000 },
        { id: 1430, name: "Chicken Pizza (Medium)", reg: 8000, ext: 8000 },
        { id: 1431, name: "Chicken Pizza (Large)", reg: 10000, ext: 10000 },
        { id: 1432, name: "Margherita Pizza (Small)", reg: 6000, ext: 6000 },
        { id: 1433, name: "Margherita Pizza (Medium)", reg: 8000, ext: 8000 },
        { id: 1434, name: "Margherita Pizza (Large)", reg: 10000, ext: 10000 },
        { id: 1435, name: "Pepperoni Pizza (Small)", reg: 7000, ext: 7000 },
        { id: 1436, name: "Pepperoni Pizza (Medium)", reg: 9000, ext: 9000 },
        { id: 1437, name: "Pepperoni Pizza (Large)", reg: 11000, ext: 11000 },
        { id: 1438, name: "BBQ Pizza (Small)", reg: 8000, ext: 8000 },
        { id: 1439, name: "BBQ Pizza (Medium)", reg: 10000, ext: 10000 },
        { id: 1440, name: "BBQ Pizza (Large)", reg: 12000, ext: 12000 },
        { id: 1441, name: "Supreme Pizza (Small)", reg: 10000, ext: 10000 },
        { id: 1442, name: "Supreme Pizza (Medium)", reg: 13000, ext: 13000 },
        { id: 1443, name: "Supreme Pizza (Large)", reg: 16000, ext: 16000 }
      ]
    }
  },
  15: {
    name: "IMOLE’S PATISSERIE",
    menu: {
      "PIES/ROLLS": [
        { id: 1501, name: "Chicken pie", reg: 1000, ext: 1000 },
        { id: 1502, name: "Meatpie", reg: 1000, ext: 1000 },
        { id: 1503, name: "Sausage roll", reg: 500, ext: 500 },
        { id: 1504, name: "Full sausage", reg: 1000, ext: 1000 },
        { id: 1505, name: "Egg rolls", reg: 500, ext: 500 }
      ],
      "SMALL CHOPS": [
        { id: 1506, name: "Small chops with chicken", reg: 3500, ext: 3500 },
        { id: 1507, name: "Small chops with beef", reg: 2500, ext: 2500 }
      ],
      "DOUGHNUTS": [
        { id: 1508, name: "Milky doughnuts (3 pack)", reg: 4500, ext: 4500 },
        { id: 1509, name: "Milky doughnuts (6 pack)", reg: 8500, ext: 8500 }
      ],
      "CAKES": [
        { id: 1510, name: "Slice Cake (naked)", reg: 2500, ext: 2500 },
        { id: 1511, name: "Slice Cake (customized)", reg: 4000, ext: 4000 },
        { id: 1512, name: "Bday Cake 6\"", reg: 15000, ext: 15000 },
        { id: 1513, name: "Bday Cake 8\"", reg: 20000, ext: 20000 },
        { id: 1514, name: "Bday Cake 10\"", reg: 25000, ext: 25000 }
      ],
      "PARFAITS": [
        { id: 1515, name: "Cake parfaits (Small)", reg: 3500, ext: 3500 },
        { id: 1516, name: "Cake parfaits (Big)", reg: 4500, ext: 4500 }
      ],
      "ICE CREAM": [
        { id: 1517, name: "Ice cream covered (S)", reg: 1000, ext: 1000 },
        { id: 1518, name: "Ice cream covered (M)", reg: 1500, ext: 1500 },
        { id: 1519, name: "Ice cream covered (L)", reg: 2200, ext: 2200 }
      ]
    }
  },
  16: {
    name: "Finey prices",
    menu: {
      "RICE/PASTA": [
        { id: 1601, name: "Rice/Pasta (Beef/Egg)", reg: 1800, ext: 1800 },
        { id: 1602, name: "Rice/Pasta (Goat)", reg: 2300, ext: 2300 },
        { id: 1603, name: "Rice/Pasta (Fish/Chicken)", reg: 2500, ext: 2500 },
        { id: 1604, name: "Rice/Pasta (Turkey)", reg: 4000, ext: 4500 }
      ],
      "NOODLES": [
        { id: 1605, name: "Stirfry noodles (Beef/Egg)", reg: 1800, ext: 1800 },
        { id: 1606, name: "Noodles with fried egg", reg: 2000, ext: 2000 },
        { id: 1607, name: "Stirfry noodles (Chicken)", reg: 3000, ext: 3000 },
        { id: 1608, name: "Stirfry noodles (Fish)", reg: 2800, ext: 2800 },
        { id: 1609, name: "Stirfry noodles (Turkey)", reg: 4500, ext: 5000 }
      ],
      "OFADA/NATIVE": [
        { id: 1610, name: "Ofada/Native (Beef)", reg: 2800, ext: 2800 },
        { id: 1611, name: "Ofada/Native (Goat)", reg: 3200, ext: 3200 },
        { id: 1612, name: "Ofada/Native (Fish)", reg: 3500, ext: 3500 },
        { id: 1613, name: "Ofada/Native (Chicken)", reg: 4000, ext: 4000 },
        { id: 1614, name: "Ofada/Native (Turkey)", reg: 5000, ext: 5500 }
      ],
      "OTHERS": [
        { id: 1615, name: "Boiled Yam/Potato (Mini)", reg: 3000, ext: 3000 },
        { id: 1616, name: "Boiled Yam/Potato (Maxi)", reg: 4000, ext: 4000 },
        { id: 1617, name: "Boiled Plantain (Mini)", reg: 3000, ext: 3000 },
        { id: 1618, name: "Boiled Plantain (Maxi)", reg: 4500, ext: 4500 },
        { id: 1619, name: "Porridge (Mini)", reg: 3000, ext: 3000 },
        { id: 1620, name: "Porridge (Maxi)", reg: 4500, ext: 4500 }
      ],
      "PEPPERED": [
        { id: 1621, name: "Gizdodo or Asun (Mini)", reg: 2000, ext: 2000 },
        { id: 1622, name: "Gizdodo or Asun (Maxi)", reg: 5000, ext: 5000 },
        { id: 1623, name: "Peppered Snails", reg: 2500, ext: 5000 },
        { id: 1624, name: "Peppered Ponmo", reg: 1500, ext: 3000 },
        { id: 1625, name: "Peppered beef & plantain", reg: 3500, ext: 6500 },
        { id: 1626, name: "Peppered goat & plantain", reg: 4000, ext: 7500 },
        { id: 1627, name: "Peppered chicken & plantain", reg: 3500, ext: 6500 },
        { id: 1628, name: "Peppered turkey & plantain", reg: 5000, ext: 9500 }
      ]
    }
  },
  17: {
    name: "ROYAL’S TREAT AND TIDBITS",
    menu: {
      "MEALS": [
        { id: 1701, name: "Stir fry spaghetti with chicken", reg: 4500, ext: 4500 },
        { id: 1702, name: "Extra plate stir fry spaghetti", reg: 5500, ext: 5500 },
        { id: 1703, name: "Yam and egg sauce", reg: 4500, ext: 4500 },
        { id: 1704, name: "Basmati Jambalaya rice and turkey", reg: 8500, ext: 8500 },
        { id: 1705, name: "Stir spaghetti chicken and plantain", reg: 5000, ext: 5000 },
        { id: 1706, name: "Basmati rice and gizzdodo", reg: 7000, ext: 7000 }
      ],
      "CHOPS": [
        { id: 1707, name: "Small chops", reg: 4500, ext: 4500 }
      ],
      "SNACKS": [
        { id: 1708, name: "Chicken pie and meat pie", reg: 1200, ext: 1200 },
        { id: 1709, name: "Buns", reg: 200, ext: 200 },
        { id: 1710, name: "Doughnuts", reg: 700, ext: 700 },
        { id: 1711, name: "Egg roll", reg: 700, ext: 700 }
      ],
      "PARFAIT": [
        { id: 1712, name: "Fruit parfait", reg: 4500, ext: 4500 },
        { id: 1713, name: "Cake parfait", reg: 3500, ext: 3500 }
      ]
    }
  },
  18: {
    name: "OKELE JOINT",
    menu: {
      "SWALLOW": [
        { id: 1801, name: "Amala", reg: 300, ext: 300 },
        { id: 1802, name: "Pounded yam", reg: 500, ext: 500 },
        { id: 1803, name: "Semo", reg: 200, ext: 200 },
        { id: 1804, name: "Fufu", reg: 200, ext: 200 },
        { id: 1805, name: "Eba", reg: 200, ext: 200 },
        { id: 1806, name: "Tuwo Rice", reg: 200, ext: 200 }
      ],
      "PROTEIN": [
        { id: 1807, name: "Cow Meat", reg: 200, ext: 200 },
        { id: 1808, name: "Goat Meat", reg: 500, ext: 500 },
        { id: 1809, name: "Fish", reg: 1000, ext: 1000 },
        { id: 1810, name: "Wara", reg: 300, ext: 300 },
        { id: 1811, name: "Ponmo", reg: 300, ext: 300 },
        { id: 1812, name: "Cow Leg", reg: 400, ext: 400 },
        { id: 1813, name: "Chicken", reg: 1500, ext: 1500 },
        { id: 1814, name: "Smoke Fish", reg: 500, ext: 500 },
        { id: 1815, name: "Hake Fish", reg: 1000, ext: 1000 }
      ]
    }
  },
  19: {
    name: "Iya afusat kitchen",
    menu: {
      "MEALS": [
        { id: 1901, name: "White rice", reg: 500, ext: 1000 },
        { id: 1902, name: "Rice and bean", reg: 500, ext: 1000 },
        { id: 1903, name: "Jollof rice", reg: 500, ext: 1000 },
        { id: 1904, name: "Bean", reg: 500, ext: 1000 },
        { id: 1905, name: "Plantain", reg: 200, ext: 200 },
        { id: 1906, name: "Spag", reg: 200, ext: 200 },
        { id: 1907, name: "Bread", reg: 500, ext: 500 }
      ],
      "SWALLOW": [
        { id: 1908, name: "Semo", reg: 200, ext: 200 },
        { id: 1909, name: "Eba", reg: 200, ext: 200 },
        { id: 1910, name: "Fufu", reg: 200, ext: 200 },
        { id: 1911, name: "Iyan", reg: 200, ext: 200 },
        { id: 1912, name: "Amala", reg: 200, ext: 200 }
      ],
      "PROTEIN": [
        { id: 1913, name: "Beef", reg: 200, ext: 500 },
        { id: 1914, name: "Ponmo", reg: 500, ext: 500 },
        { id: 1915, name: "Titus fish", reg: 1000, ext: 1000 },
        { id: 1916, name: "Wara", reg: 500, ext: 500 },
        { id: 1917, name: "Egg", reg: 400, ext: 400 }
      ],
      "TAKEAWAY": [
        { id: 1918, name: "Big takeaway", reg: 250, ext: 250 },
        { id: 1919, name: "Small takeaway", reg: 200, ext: 200 }
      ]
    }
  },
  20: {
    name: "Jamblack hubs",
    menu: {
      "SHAWARMA": [
        { id: 2001, name: "Medium", reg: 3500, ext: 3500 },
        { id: 2002, name: "Large", reg: 5000, ext: 5000 }
      ],
      "PASTA & MEALS": [
        { id: 2003, name: "Spaghetti with Chicken", reg: 3500, ext: 3500 },
        { id: 2004, name: "Spaghetti with Turkey", reg: 5500, ext: 5500 },
        { id: 2005, name: "Penne Pasta with Chicken", reg: 4500, ext: 4500 }
      ],
      "EXTRAS": [
        { id: 2006, name: "Turkey", reg: 6500, ext: 6500 },
        { id: 2007, name: "Toast Bread", reg: 700, ext: 700 },
        { id: 2008, name: "Beef", reg: 500, ext: 500 },
        { id: 2009, name: "Ponmo", reg: 500, ext: 500 },
        { id: 2010, name: "Sausage", reg: 500, ext: 500 },
        { id: 2011, name: "Plantain", reg: 500, ext: 500 }
      ]
    }
  },
  21: {
    name: "Opeyemi Food Canteen",
    menu: {
      "SWALLOW": [
        { id: 2101, name: "Pounded Yam", reg: 600, ext: 600 },
        { id: 2102, name: "Amala", reg: 200, ext: 200 },
        { id: 2103, name: "Eba", reg: 200, ext: 200 },
        { id: 2104, name: "Semo", reg: 200, ext: 200 }
      ],
      "PROTEIN": [
        { id: 2105, name: "Beef", reg: 500, ext: 500 },
        { id: 2106, name: "Turkey", reg: 4000, ext: 4000 },
        { id: 2107, name: "Ponmo", reg: 500, ext: 500 },
        { id: 2108, name: "Titus fish", reg: 2000, ext: 2000 },
        { id: 2109, name: "Wara", reg: 500, ext: 500 }
      ]
    }
  }
};

// --- 5. HELPERS ---
function generateId() {
  return Math.floor(1000 + Math.random() * 9000);
}

function formatCurrency(amount) {
  return `₦${amount.toLocaleString()}`;
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

    // --- B. MEDIA HANDLING (Payment Screenshots) ---
    if (numMedia > 0) {
      const userSnap = await db.ref(`users/${from}`).once('value');
      const user = userSnap.val();
      const mediaUrl = req.body.MediaUrl0; 
      
      if (user && user.step === 'awaiting_payment') {
        await createOrderInDB(from, user, twiml, mediaUrl);
        return res.type('text/xml').send(twiml.toString());
      } else {
        twiml.message("Please complete the text steps first. Reply 'Menu' to restart.");
        return res.type('text/xml').send(twiml.toString());
      }
    }

    // --- C. RIDER REGISTRATION ---
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
        twiml.message(`✅ Registration Successful!\n\nWelcome ${riderName}. Text "ON DUTY" to start.`);
      } else {
        twiml.message('❌ Invalid Registration Code.');
      }
      return res.type('text/xml').send(twiml.toString());
    }

    const userSnap = await db.ref(`users/${from}`).once('value');
    const user = userSnap.val() || { step: 'new' };

    // --- GLOBAL CANCEL COMMAND ---
    if ((msg === 'cancel' || msg === '0') && user.step !== 'main_menu' && user.step !== 'new') {
        await resetUser(from, twiml);
        return res.type('text/xml').send(twiml.toString());
    }

    // --- CHECK ACTIVE ORDER STATUS (BLOCKING STATE) ---
    const orderId = user.last_order_id;
    if (orderId) {
        const orderSnap = await db.ref(`orders/${orderId}`).once('value');
        const order = orderSnap.val();
        
        if (order && (order.status === 'pending_payment' || order.status === 'seeking_rider' || order.status === 'rider_accepted')) {
            let msg = "";
            if (order.status === 'pending_payment') {
                msg = "⏳ *Please Wait*\n\nWe are confirming your payment.\n\nDon't reply to this message, you will be updated soon.";
            } else if (order.status === 'seeking_rider') {
                msg = "⏳ *Please Wait*\n\nWe are assigning a rider to your order.\n\nDon't reply to this text to avoid mix up. You will be updated shortly.";
            } else if (order.status === 'rider_accepted') {
                msg = "⏳ *Rider Assigned*\n\nYour order has been accepted by a rider.\n\nDon't reply here. Contact rider directly.";
            }

            twiml.message(msg);
            return res.type('text/xml').send(twiml.toString());
        }
    }

    // --- D. ADMIN COMMANDS ---
    if (from === ADMIN_PHONE) {
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

    // --- E. RIDER COMMANDS ---
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

    // --- F. CUSTOMER FLOW STATE MACHINE ---
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
        await handleVendorSelect(from, parseInt(msg), twiml);
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
           twiml.message("📝 Please provide your Full Name.");
        } else {
           twiml.message("Reply 1 or 2.");
        }
        break;
      case 'errand_type':
        await handleErrandType(from, parseInt(msg), twiml);
        break;
      case 'errand_details':
        await handleErrandDetails(from, originalMsg, twiml);
        break;
      // --- NEW PICKUP FLOW STEPS ---
      case 'pickup_description':
        await handlePickupDescription(from, originalMsg, twiml);
        break;
      case 'vendor_name':
        await handleVendorName(from, originalMsg, twiml);
        break;
      case 'vendor_phone':
        await handleVendorPhone(from, originalMsg, twiml);
        break;
      // -----------------------------
      case 'customer_name':
        await handleCustomerName(from, originalMsg, twiml);
        break;
      case 'customer_phone':
        await handleCustomerPhone(from, originalMsg, twiml);
        break;
      case 'pickup_location':
        await handlePickupLocation(from, originalMsg, twiml);
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
        twiml.message("I didn't understand that. Reply 'Menu' to restart.");
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
    errand_data: {}
  });
  const welcomeMsg = `🍽️ *Welcome to ChowZone!*\n\nHow can we help you today?\n\n1. Order Food\n2. Errands (Market/Pharmacy/Pickup)\n\nReply with number 1 or 2.\n(Text 'Cancel' anytime to restart)`;
  twiml.message(welcomeMsg);
}

async function handleMainMenu(from, msg, twiml) {
  if (msg === '1') {
    await db.ref(`users/${from}`).update({
      step: 'vendor_select',
      order_type: 'food'
    });
    let txt = `🏪 *Select Vendor*\n\n`;
    for (let key in VENDORS) {
        txt += `${key}. ${VENDORS[key].name}\n`;
    }
    twiml.message(txt);
  } else if (msg === '2') {
    await db.ref(`users/${from}`).update({
      step: 'errand_type',
      order_type: 'errand'
    });
    twiml.message(`🏃 *Select Errand Type*\n\n1. 🛒 Market Shopping\n2. 📦 Pick Up Item\n3. 💊 Pharmacy / Supermarket\n4. 📝 Campus Task\n\nReply with number.`);
  } else {
    twiml.message("Invalid option. Reply 1 or 2.");
  }
}

async function handleVendorSelect(from, id, twiml) {
    if (!VENDORS[id]) return twiml.message("Invalid vendor.");
    await db.ref(`users/${from}`).update({
        step: 'category_select',
        selected_vendor: id
    });
    await showCategories(from, twiml);
}

async function showCategories(from, twiml) {
  const userSnap = await db.ref(`users/${from}`).once('value');
  const user = userSnap.val();
  const vendorId = user.selected_vendor;
  const vendor = VENDORS[vendorId];
  
  await db.ref(`users/${from}/step`).set('category_select');
  
  let msg = `🍽️ *${vendor.name} Categories*\n\n`;
  Object.keys(vendor.menu).forEach((catKey, index) => {
      msg += `${index + 1}. ${catKey.replace('_', ' ')}\n`;
  });
  msg += `\nReply number.`;
  twiml.message(msg);
}

async function handleCategorySelect(from, choice, twiml) {
  const userSnap = await db.ref(`users/${from}`).once('value');
  const user = userSnap.val();
  const vendorId = user.selected_vendor;
  const vendor = VENDORS[vendorId];

  // Get category key by index (0 = first category, 1 = second, etc)
  const categoryKeys = Object.keys(vendor.menu);
  const categoryKey = categoryKeys[choice - 1];

  if (!categoryKey) return twiml.message("Invalid category.");

  await db.ref(`users/${from}`).update({
    step: 'item_select',
    current_category: categoryKey
  });

  let msg = `*${categoryKey.replace('_', ' ')}*\n\n`;
  vendor.menu[categoryKey].forEach(item => {
    const priceTxt = (item.reg === item.ext) ? formatCurrency(item.reg) : `${formatCurrency(item.reg)} / ${formatCurrency(item.ext)}`;
    msg += `${item.id}. ${item.name} - ${priceTxt}\n`;
  });
  msg += `\nReply item number.`;
  twiml.message(msg);
}

async function handleItemSelect(from, id, twiml) {
  const userSnap = await db.ref(`users/${from}`).once('value');
  const user = userSnap.val();
  const vendorId = user.selected_vendor;
  const vendor = VENDORS[vendorId];
  const categoryKey = user.current_category;
  const cat = vendor.menu[categoryKey];
  const item = cat.find(i => i.id === id);

  if (!item) return twiml.message("Invalid item number.");
  
  await db.ref(`users/${from}`).update({
    step: 'size_select',
    selected_item: item
  });

  if (item.reg === item.ext) {
    await db.ref(`users/${from}/step`).set('quantity_select');
    twiml.message(`*${item.name}*\n\nPrice: ${formatCurrency(item.reg)}\n\nHow many? (Enter number)`);
  } else {
    let msg = `*${item.name}*\n\nSelect Portion:\n1. Regular (${formatCurrency(item.reg)})\n2. Extra (${formatCurrency(item.ext)})\n\nReply 1 or 2.`;
    twiml.message(msg);
  }
}

async function handleSizeSelect(from, msg, twiml) {
  const userSnap = await db.ref(`users/${from}`).once('value');
  const item = userSnap.val().selected_item;
  
  if (msg !== '1' && msg !== '2') {
      return twiml.message("Invalid choice. Reply 1 for Regular or 2 for Extra.");
  }

  const size = msg === '1' ? 'reg' : 'ext';
  const price = item[size];
  const label = msg === '1' ? 'Regular' : 'Extra';

  await db.ref(`users/${from}`).update({
    step: 'quantity_select',
    selected_item_price: price,
    selected_size: label
  });

  twiml.message(`*${item.name} (${label})*\n\nPrice: ${formatCurrency(price)}\n\nHow many? (Enter number)`);
}

async function handleQuantitySelect(from, msg, twiml) {
  const qty = parseInt(msg);
  if (isNaN(qty) || qty <= 0) {
    return twiml.message("⚠️ Please enter a valid number (e.g., 2).");
  }

  const userSnap = await db.ref(`users/${from}`).once('value');
  const user = userSnap.val();
  const item = userSnap.val().selected_item;
  const price = user.selected_item_price || item.reg;
  const size = user.selected_size || (item.reg === item.ext ? 'Regular' : 'Regular');

  const newItem = {
    name: item.name,
    price: price,
    qty: qty,
    size: size,
    type: 'main'
  };

  const cart = user.cart || [];
  cart.push(newItem);

  // Most vendors don't have a specific protein category defined in the provided list
  // So we skip the protein loop for now or implement a generic "Add more" step
  await db.ref(`users/${from}`).update({
    step: 'add_more_or_checkout',
    cart: cart
  });
  twiml.message(`✅ Added ${qty}x ${item.name}.\n\nDo you want to add another item?\n1. Yes (Add Food)\n2. No (Checkout)`);
}

async function handleProteinLoop(from, msg, twiml) {
  // Simplified for multi-vendor: Just loop back to categories
  if (msg === '1') {
    await showCategories(from, twiml);
  } else if (msg === '2') {
    const userSnap = await db.ref(`users/${from}`).once('value');
    await showCartSummary(from, userSnap.val().cart, twiml);
  } else {
    twiml.message("Reply 1 or 2.");
  }
}

async function handleProteinSelect(from, id, twiml) {
  // Removed as Proteins are now just items in vendor menus
  twiml.message("Please add items from the menu.");
}

async function handleProteinSize(from, msg, twiml) {
   // Removed
}

async function handleProteinQty(from, msg, twiml) {
   // Removed
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
  twiml.message(txt);
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
  else return twiml.message("Invalid selection.");

  await db.ref(`users/${from}`).update({
    errand_type: typeStr,
    needs_shopping: needsShopping,
    is_pickup: isPickup
  });

  if (isPickup) {
    await db.ref(`users/${from}/step`).set('pickup_description');
    twiml.message("📝 *Describe task or pickup details:*\n(e.g., Get a bag of drink at Tarmac)");
  } else if (needsShopping) {
    await db.ref(`users/${from}/step`).set('errand_details');
    twiml.message(`📝 *List the items you want to buy.*\n\nFormat: Item Price, Item Price\nExample: Beans 2000, Oil 500`);
  } else {
    await db.ref(`users/${from}/step`).set('pickup_description');
    twiml.message("📝 *Describe the task:*");
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

  if (items.length === 0) return twiml.message("⚠️ Could not read prices. Example: 'Beans 2000'");

  await db.ref(`users/${from}`).update({
    step: 'customer_name',
    errand_items: items,
    shopping_budget: budget
  });

  let msg = `✅ Items saved:\n`;
  items.forEach(i => msg += `- ${i.name}: ${formatCurrency(i.price)}\n`);
  msg += `\nTotal Items Cost: ${formatCurrency(budget)}\n\n📝 Next, please provide your Name.`;
  twiml.message(msg);
}

// --- NEW PICKUP FLOW FUNCTIONS ---

async function handlePickupDescription(from, text, twiml) {
    if (!text || text.trim().length === 0) return twiml.message("⚠️ Description cannot be empty.");
    await db.ref(`users/${from}`).update({
        step: 'vendor_name',
        errand_description: text
    });
    twiml.message("👤 *Who are we picking from?*\n\nPlease provide the Name of the person or shop.");
}

async function handleVendorName(from, text, twiml) {
    if (!text || text.trim().length === 0) return twiml.message("⚠️ Name cannot be empty.");
    await db.ref(`users/${from}`).update({
        step: 'vendor_phone',
        vendor_name: text
    });
    twiml.message("📞 *What is their Phone Number?*\n(We need to contact them).");
}

async function handleVendorPhone(from, text, twiml) {
    const cleanPhone = text.replace(/\D/g,'');
    if (cleanPhone.length < 10) return twiml.message("⚠️ Invalid phone number.");
    
    await db.ref(`users/${from}`).update({
        step: 'customer_name',
        vendor_phone: cleanPhone
    });
    twiml.message("👤 *What is YOUR Name?* (Customer Name)");
}

// --- GENERAL CHECKOUT FLOW HANDLERS ---

async function handleCustomerName(from, text, twiml) {
    if (!text || text.trim().length === 0) return twiml.message("⚠️ Name cannot be empty.");
    await db.ref(`users/${from}`).update({
        step: 'customer_phone',
        customer_name: text
    });
    twiml.message("📞 Please share YOUR Phone Number (e.g. 08012345678).");
}

async function handleCustomerPhone(from, text, twiml) {
    const cleanPhone = text.replace(/\D/g,'');
    if (cleanPhone.length < 10) return twiml.message("⚠️ Invalid phone number. Please enter a valid number.");

    await db.ref(`users/${from}`).update({
        step: 'pickup_location',
        customer_phone: cleanPhone
    });

    const userSnap = await db.ref(`users/${from}`).once('value');
    const user = userSnap.val();

    if (user.order_type === 'food') {
        const vendor = VENDORS[user.selected_vendor];
        twiml.message(`📍 *Where is the Pickup Location?*\n\n1. ${vendor.name} (Default)\n2. Type a different address\n\nReply 1 or 2.`);
    } else {
        twiml.message("📍 *Where is the Pickup Location?*\n\n(e.g. Tarmac, School Road, Westend, Safari)");
    }
}

async function handlePickupLocation(from, text, twiml) {
    const userSnap = await db.ref(`users/${from}`).once('value');
    const user = userSnap.val();
    let location = text;

    if (user.order_type === 'food' && text.trim() === '1') {
        const vendor = VENDORS[user.selected_vendor];
        location = vendor.name; // Use Vendor Name as Default Location
    } else if (user.order_type === 'food' && text.trim() === '2') {
        await db.ref(`users/${from}/step`).set('pickup_location_manual');
        return twiml.message("📍 Please type the specific pickup address:");
    }

    await db.ref(`users/${from}`).update({
        step: 'delivery_location',
        pickup_location: location
    });
    twiml.message("📍 Where should the rider drop the items? (Your Hostel/Room/Address)");
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

    // Customer Details
    summary += `👤 Name: ${user.customer_name}\n`;
    summary += `📞 Phone: ${user.customer_phone}\n\n`;

    // Vendor/Source Details (If Pickup)
    if (user.vendor_name) {
        summary += `🏪 Pickup From: ${user.vendor_name}\n`;
        summary += `📞 Vendor Phone: ${user.vendor_phone}\n\n`;
    }

    // Order Content
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
    twiml.message(summary);
}

async function handleFinalConfirm(from, msg, twiml) {
  if (msg !== 'confirm') return twiml.message("Please type CONFIRM to proceed.");

  const userSnap = await db.ref(`users/${from}`).once('value');
  const user = userSnap.val();

  await db.ref(`users/${from}`).update({
    step: 'awaiting_payment'
  });

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
      step: 'new',
      last_order_id: orderId 
  });

  twiml.message(`✅ *Order Received!*\n\nYour Order #${orderId} is worth ${formatCurrency(total)}.\n\nWe are verifying your payment now. You will be notified shortly.`);

  try {
    const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    
    let adminPhone = ADMIN_PHONE;
    if (!adminPhone.startsWith('whatsapp:')) {
      adminPhone = `whatsapp:${adminPhone}`;
    }

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
      from: process.env.TWILIO_PHONE_NUMBER,
      to: adminPhone,
      body: adminMsg
    };

    if (mediaUrl) {
      messageOptions.mediaUrl = [mediaUrl];
    }

    await client.messages.create(messageOptions);
  } catch (err) {
    console.error("Failed to send Admin notification:", err);
  }
}

async function approveOrder(orderId) {
  const snap = await db.ref(`orders/${orderId}`).once('value');
  const order = snap.val();
  if (!order) return;

  await db.ref(`orders/${orderId}/status`).set('seeking_rider');
  
  const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  
  await client.messages.create({
    from: process.env.TWILIO_PHONE_NUMBER,
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

  const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  await client.messages.create({
    from: process.env.TWILIO_PHONE_NUMBER,
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

  const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

  const adminMsg = `🛵 *RIDER ACCEPTED JOB*\n\n` +
                  `Order #${orderId}\n` +
                  `Rider Name: ${rider.name}\n` +
                  `Rider Phone: ${riderPhone}\n\n` +
                  `Please contact rider to arrange details and send the order payment to his account manually.`;

  await client.messages.create({
    from: process.env.TWILIO_PHONE_NUMBER,
    to: ADMIN_PHONE,
    body: adminMsg
  });

  await client.messages.create({
    from: process.env.TWILIO_PHONE_NUMBER,
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
    const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    
    await db.ref(`users/${order.customer}`).update({ step: 'rate_rider' });
    
    await client.messages.create({
      from: process.env.TWILIO_PHONE_NUMBER,
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
        return twiml.message("Please enter a number between 1 and 5.");
    }
    const userSnap = await db.ref(`users/${from}`).once('value');
    const user = userSnap.val();
    const orderId = user.last_order_id;
    await db.ref(`orders/${orderId}/rating/rider`).set(rating);
    await db.ref(`users/${from}`).update({ step: 'rate_service' });
    twiml.message(`Thanks! How would you rate ChowZone service? (1-5 stars)`);
}

async function handleRateService(from, msg, twiml) {
    const rating = parseInt(msg);
    if (isNaN(rating) || rating < 1 || rating > 5) {
        return twiml.message("Please enter a number between 1 and 5.");
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
  
  const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  
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
          from: process.env.TWILIO_PHONE_NUMBER,
          to: rider.phone,
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
