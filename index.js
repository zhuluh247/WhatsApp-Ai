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

// --- 4. VENDORS DATA ---
const VENDORS = {
  "BISSY_JOY": {
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
  "TEE_JAY": {
    name: "Tee Jay Frozen Food",
    address: "Tee Jay Frozen Foods Store",
    categories: {
      "FISH": [
        { id: 1, name: "Shawa (Per Kilo)", price: 3400 },
        { id: 2, name: "Titus (Per Kilo)", price: 7000 },
        { id: 3, name: "Hake (Per Kilo)", price: 5200 },
        { id: 4, name: "Kote (Per Kilo)", price: 4000 },
        { id: 5, name: "Croacker (Per Kilo)", price: 6000 },
        { id: 6, name: "Snail (Per Kilo)", price: 7000 },
        { id: 7, name: "Cheese (Per Kilo)", price: 4000 }
      ],
      "TURKEY": [
        { id: 1, name: "Wings (Per Kilo)", price: 9999 },
        { id: 2, name: "Finger (Per Kilo)", price: 7000 },
        { id: 3, name: "Chicken Filet (Per Kilo)", price: 6200 }
      ],
      "CHICKEN": [
        { id: 1, name: "Whole (Per Kilo)", price: 4600 },
        { id: 2, name: "Gizzard (Per Kilo)", price: 5200 },
        { id: 3, name: "Leg & Head (Per Kilo)", price: 2200 },
        { id: 4, name: "Neck (Per Kilo)", price: 2500 },
        { id: 5, name: "Wings (Per Kilo)", price: 6000 },
        { id: 6, name: "Breast (Per Kilo)", price: 5000 }
      ],
      "OTHERS": [
        { id: 1, name: "Sausages (Per Pack)", price: 2600 },
        { id: 2, name: "Sharwama Bread (Per Pack)", price: 1300 },
        { id: 3, name: "Chips/Fries (Per Pack)", price: 4500 },
        { id: 4, name: "Shrimps (Per Pack)", price: 13000 },
        { id: 5, name: "Crabs (Per Pack)", price: 6000 }
      ]
    }
  },
  "BIGGY_SHACK": {
    name: "Biggy’s Shack Sharwama",
    address: "Biggy's Shack",
    categories: {
      "MENU": [
        { id: 1, name: "Double Sausage Chicken", price: 3000 },
        { id: 2, name: "Double Sausage Extra Chicken", price: 3500 },
        { id: 3, name: "Double Sausage Chicken/Suya", price: 4000 },
        { id: 4, name: "Double Sausage Suya Filled", price: 4000 },
        { id: 5, name: "Combo Extra Chicken/Suya", price: 4500 },
        { id: 6, name: "Bread Warma", price: 6000 },
        { id: 7, name: "Big Men Size Shawarma", price: 8000 },
        { id: 8, name: "Chicken and Chips", price: 5000 },
        { id: 9, name: "Friends Combo", price: 7500 }
      ]
    }
  },
  "ZROF_PHARMACY": {
    name: "Zrof Pharmacy",
    address: "Zrof Pharmacy Store",
    categories: {
      "CONTRACEPTIVES": [
        { id: 1, name: "Postinor 2", price: 2500 },
        { id: 2, name: "Post Pill", price: 2500 },
        { id: 3, name: "Back-up", price: 2000 }
      ],
      "SUPPLEMENTS": [
        { id: 1, name: "Evening Primrose Oil", price: 13200 },
        { id: 2, name: "Well Roze Capsules", price: 6200 },
        { id: 3, name: "Omega H3", price: 3000 },
        { id: 4, name: "Obron 6 Plus", price: 1500 },
        { id: 5, name: "Feroglobin B12", price: 5800 }
      ],
      "MALARIA_TREATMENT": [
        { id: 1, name: "Lonart-DS", price: 3700 },
        { id: 2, name: "Amatem Softgel Forte", price: 3000 },
        { id: 3, name: "Artequick", price: 6000 },
        { id: 4, name: "P-Alaxin", price: 2000 },
        { id: 5, name: "Co-Mal", price: 1000 }
      ],
      "SYRUPS_DROPS": [
        { id: 1, name: "Sirop Dynewell Plus", price: 7500 },
        { id: 2, name: "Dynewell", price: 4200 },
        { id: 3, name: "De-Deon 5", price: 3500 },
        { id: 4, name: "Apetadine", price: 2000 },
        { id: 5, name: "Astymin/Astyfer", price: 4500 },
        { id: 6, name: "Avro/Gold Apetit", price: 1500 }
      ],
      "OTHERS": [
        { id: 1, name: "Strepsils Intensive", price: 3000 },
        { id: 2, name: "Kiss", price: 550 },
        { id: 3, name: "Gold Circle", price: 500 },
        { id: 4, name: "Durex Feels", price: 1500 }
      ]
    }
  },
  "YK_NOODLES": {
    name: "YK Noodles",
    address: "YK Noodles Spot",
    categories: {
      "NOODLES": [
        { id: 1, name: "Royal", price: 7950 },
        { id: 2, name: "Tropicana", price: 7150 },
        { id: 3, name: "Turkit Top", price: 6650 },
        { id: 4, name: "Relish", price: 5850 },
        { id: 5, name: "Sea Mix", price: 3950 },
        { id: 6, name: "Delight", price: 3150 },
        { id: 7, name: "Banger", price: 2650 },
        { id: 8, name: "Classic", price: 1850 }
      ]
    }
  },
  "BIG_MUMMY": {
    name: "Big Mummy’s Kitchen",
    address: "Big Mummy's Kitchen",
    categories: {
      "MEALS": [
        { id: 1, name: "Small Plate (Chicken)", price: 2500 },
        { id: 2, name: "Big Plate (Chicken)", price: 3000 },
        { id: 3, name: "Small Plate (Meat & Egg)", price: 2000 },
        { id: 4, name: "Yam Porridge", price: 1500 },
        { id: 5, name: "White Rice & Beans", price: 1500 }
      ],
      "EXTRAS": [
        { id: 1, name: "Extra Chicken", price: 1000 },
        { id: 2, name: "Extra Meat", price: 300 },
        { id: 3, name: "Extra Egg", price: 300 }
      ]
    }
  },
  "DEEMEALLAB": {
    name: "Deemeallab Restaurant",
    address: "Deemeallab",
    categories: {
      "EVERYDAY_MEALS": [
        { id: 1, name: "Spaghetti & Sauce", price: 2000 },
        { id: 2, name: "Special Fried Rice", price: 4000 },
        { id: 3, name: "Fried Rice", price: 1500 },
        { id: 4, name: "Eba & Egusi", price: 1800 },
        { id: 5, name: "White Rice & Beans", price: 1700 },
        { id: 6, name: "Yam Porridge", price: 1500 },
        { id: 7, name: "White Rice & Sauce", price: 1500 },
        { id: 8, name: "White Rice", price: 1000 },
        { id: 9, name: "Plantain", price: 500 },
        { id: 10, name: "Coleslaw", price: 1500 },
        { id: 11, name: "Bread", price: 1200 },
        { id: 12, name: "Samosa/Chops", price: 1500 },
        { id: 13, name: "Noodles", price: 1500 }
      ],
      "MONDAY_SPECIAL": [
        { id: 1, name: "Catfish Stew", price: 2000 },
        { id: 2, name: "Toast Bread + Coffee", price: 3500 },
        { id: 3, name: "Tapioca", price: 3000 },
        { id: 4, name: "Efo Riro + Swallow", price: 2500 },
        { id: 5, name: "Moi Moi", price: 3000 }
      ],
      "PROTEINS": [
        { id: 1, name: "Chicken Wings/Beef/Assorted/Ponmo/Kote/Panla", price: 1000 },
        { id: 2, name: "Egg", price: 500 },
        { id: 3, name: "Titus/Snail/Chicken/Catfish/Goat Meat", price: 2500 },
        { id: 4, name: "Turkey", price: 4500 },
        { id: 5, name: "Gizzard", price: 1000 },
        { id: 6, name: "Smoked Catfish", price: 2500 }
      ]
    }
  },
  "SAVORE": {
    name: "Savoré by Adebayo",
    address: "Savoré by Adebayo",
    categories: {
      "SMALL_PLATES_CHICKEN": [
        { id: 1, name: "Fried Rice & Jollof", price: 3000 },
        { id: 2, name: "Jollof Only", price: 3000 },
        { id: 3, name: "Stir-fry Rice", price: 3000 },
        { id: 4, name: "Stir-fried Spaghetti", price: 3200 }
      ],
      "BIG_PLATES_CHICKEN": [
        { id: 1, name: "Fried Rice & Jollof", price: 4000 },
        { id: 2, name: "Jollof Only", price: 4000 },
        { id: 3, name: "Stir-fry Rice", price: 4000 },
        { id: 4, name: "Stir-fried Spaghetti", price: 4200 }
      ],
      "SMALL_PLATES_TURKEY": [
        { id: 1, name: "Fried Rice & Jollof", price: 4000 },
        { id: 2, name: "Jollof Only", price: 4000 },
        { id: 3, name: "Stir-fry Rice", price: 4000 },
        { id: 4, name: "Stir-fried Spaghetti", price: 4200 }
      ],
      "BIG_PLATES_TURKEY": [
        { id: 1, name: "Fried Rice & Jollof", price: 5500 },
        { id: 2, name: "Jollof Only", price: 5500 },
        { id: 3, name: "Stir-fry Rice", price: 5500 },
        { id: 4, name: "Stir-fried Spaghetti", price: 5700 }
      ],
      "EXTRAS": [
        { id: 1, name: "Plantain", price: 500 },
        { id: 2, name: "Coleslaw", price: 500 },
        { id: 3, name: "Extra Chicken", price: 1500 },
        { id: 4, name: "Extra Turkey", price: 3000 }
      ],
      "BENTO_CAKES": [
        { id: 1, name: "Basic", price: 8500 },
        { id: 2, name: "Whipped Cream", price: 10000 }
      ]
    }
  },
  "ROYAL_CHAW": {
    name: "Royal Chaw Spot",
    address: "Royal Chaw Spot",
    categories: {
      "SHARWAMA": [
        { id: 1, name: "No Sausage", price: 2000 },
        { id: 2, name: "Single Sausage", price: 2500 },
        { id: 3, name: "Double Sausage", price: 3000 },
        { id: 4, name: "Royal Special", price: 4000 },
        { id: 5, name: "Cheesy", price: 4000 }
      ],
      "BURGERS": [
        { id: 1, name: "Single Chicken", price: 5000 },
        { id: 2, name: "Double Chicken", price: 6000 }
      ],
      "FRIES": [
        { id: 1, name: "Loaded", price: 5000 },
        { id: 2, name: "Loaded + Cheese", price: 6000 },
        { id: 3, name: "Chicken & Fries", price: 5000 },
        { id: 4, name: "Extra Chicken", price: 1500 },
        { id: 5, name: "Extra Fries", price: 1000 }
      ],
      "BREAD_SHARWAMA": [
        { id: 1, name: "No Sausage", price: 2000 },
        { id: 2, name: "Single Sausage", price: 2500 },
        { id: 3, name: "Double Sausage", price: 3000 },
        { id: 4, name: "Jumbo", price: 3500 }
      ],
      "OTHERS": [
        { id: 1, name: "Sandwich", price: 700 },
        { id: 2, name: "Royal Pizza", price: 10000 },
        { id: 3, name: "Nkwobi Small", price: 4000 },
        { id: 4, name: "Nkwobi Large", price: 6000 }
      ],
      "BARBECUE": [
        { id: 1, name: "Small", price: 4000 },
        { id: 2, name: "Medium", price: 5000 },
        { id: 3, name: "Large", price: 6500 }
      ]
    }
  },
  "HOT_OOLE": {
    name: "Hot Oole",
    address: "Hot Oole Spot",
    categories: {
      "MENU": [
        { id: 1, name: "Special Combo Moi Moi", price: 1500 },
        { id: 2, name: "Moi Moi (With Egg)", price: 700 },
        { id: 3, name: "Moi Moi (With Fish)", price: 600 },
        { id: 4, name: "Moi Moi (Plain)", price: 400 },
        { id: 5, name: "Tapioca (Small)", price: 1200 },
        { id: 6, name: "Tapioca (Big)", price: 1500 },
        { id: 7, name: "Fura (Small)", price: 1200 },
        { id: 8, name: "Fura (Big)", price: 1500 },
        { id: 9, name: "Extra Milk", price: 300 },
        { id: 10, name: "Kunu/Zobo", price: 1000 },
        { id: 11, name: "Breakfast Combo", price: 3000 }
      ]
    }
  },
  "WRAP_STAR": {
    name: "Wrap Star Shawarma",
    address: "Wrap Star",
    categories: {
      "SHARWAMA": [
        { id: 1, name: "Chicken", price: 2500 },
        { id: 2, name: "Beef", price: 2800 },
        { id: 3, name: "Single Sausage", price: 2700 },
        { id: 4, name: "Double Sausage", price: 3000 },
        { id: 5, name: "Chicken & Beef", price: 3000 },
        { id: 6, name: "Mixed + 1 Sausage", price: 3500 },
        { id: 7, name: "Mixed + 2 Sausage", price: 3800 },
        { id: 8, name: "Special", price: 4500 }
      ],
      "BURGERS": [
        { id: 1, name: "Single Chicken", price: 4500 },
        { id: 2, name: "Double Chicken", price: 5000 },
        { id: 3, name: "Beef Suya", price: 4500 }
      ],
      "FRIES": [
        { id: 1, name: "Fries & Chicken", price: 5500 },
        { id: 2, name: "Beef Kebab", price: 2000 },
        { id: 3, name: "Kebab & Fries", price: 4500 },
        { id: 4, name: "Fries Combo", price: 7000 },
        { id: 5, name: "Loaded Fries", price: 6000 }
      ]
    }
  },
  "CHAO_COCINA": {
    name: "Chao Cocina",
    address: "Chao Cocina",
    categories: {
      "STIRFRY_SPAGHETTI": [
        { id: 1, name: "Large Turkey", price: 3800 },
        { id: 2, name: "Medium Turkey", price: 3300 },
        { id: 3, name: "Large Asun", price: 3300 },
        { id: 4, name: "Medium Asun", price: 3000 }
      ],
      "EXTRAS": [
        { id: 1, name: "Turkey", price: 2800 },
        { id: 2, name: "Asun", price: 2000 },
        { id: 3, name: "Stirfry", price: 1000 },
        { id: 4, name: "Sausage", price: 400 }
      ],
      "SIDES": [
        { id: 1, name: "Fries & Turkey", price: 5500 },
        { id: 2, name: "Fries & Asun", price: 5000 },
        { id: 3, name: "Plantain", price: 500 },
        { id: 4, name: "Ketchup", price: 300 }
      ],
      "DRINKS": [
        { id: 1, name: "Water", price: 300 },
        { id: 2, name: "Soft Drinks", price: 500 },
        { id: 3, name: "Fearless/Malt", price: 600 },
        { id: 4, name: "Fayrouz/Chivita", price: 800 }
      ]
    }
  },
  "KRAFTY_KITCHEN": {
    name: "Krafty Kitchen",
    address: "Krafty Kitchen",
    categories: {
      "FOOD": [
        { id: 1, name: "Small Plate Chicken", price: 2500 },
        { id: 2, name: "Big Plate Chicken", price: 3000 },
        { id: 3, name: "Ofada Rice", price: 4500 },
        { id: 4, name: "Fish BBQ", price: 3000 },
        { id: 5, name: "Pasta Chicken (Small)", price: 3000 },
        { id: 6, name: "Pasta Chicken (Big)", price: 3500 },
        { id: 7, name: "Pasta Beef (Small)", price: 2200 },
        { id: 8, name: "Pasta Beef (Big)", price: 2700 },
        { id: 9, name: "Rice Beef (Small)", price: 1700 },
        { id: 10, name: "Rice Beef (Big)", price: 2200 }
      ],
      "SIDES": [
        { id: 1, name: "Plantain", price: 500 },
        { id: 2, name: "Coleslaw", price: 500 },
        { id: 3, name: "Fruit Parfait (Small)", price: 3500 },
        { id: 4, name: "Fruit Parfait (Big)", price: 4000 },
        { id: 5, name: "Beef", price: 500 },
        { id: 6, name: "Egg", price: 400 }
      ],
      "SHARWAMA": [
        { id: 1, name: "No Sausage", price: 2000 },
        { id: 2, name: "Chicken/Beef", price: 2500 },
        { id: 3, name: "Combo", price: 3000 },
        { id: 4, name: "+ Single Sausage", price: 2500 },
        { id: 5, name: "+ Double Sausage", price: 3000 },
        { id: 6, name: "Special with Drink", price: 4000 }
      ],
      "DRINKS": [
        { id: 1, name: "Viju/Nutri Milk", price: 700 },
        { id: 2, name: "Soda/Water", price: 400 },
        { id: 3, name: "Fearless/Predator", price: 600 },
        { id: 4, name: "Zobo/Exotic", price: 800 },
        { id: 5, name: "Big Exotic", price: 1500 },
        { id: 6, name: "Monster/Berry Blast", price: 1800 }
      ]
    }
  },
  "SPAG_CITY": {
    name: "Spag City",
    address: "Spag City",
    categories: {
      "MENU": [
        { id: 1, name: "Spag & Big Turkey", price: 6500 },
        { id: 2, name: "Spag & Mid Turkey", price: 4000 },
        { id: 3, name: "Spag & Chicken", price: 3600 },
        { id: 4, name: "Sharwama Single Sausage", price: 2500 },
        { id: 5, name: "Sharwama Double Sausage", price: 3000 }
      ],
      "EXTRAS": [
        { id: 1, name: "Beef", price: 500 },
        { id: 2, name: "Sausage", price: 500 },
        { id: 3, name: "Plantain", price: 500 },
        { id: 4, name: "Coleslaw", price: 500 },
        { id: 5, name: "Asun", price: 2000 }
      ]
    }
  },
  "HD_TREATS": {
    name: "HD Treats",
    address: "HD Treats",
    categories: {
      "BURGERS": [
        { id: 1, name: "Single Chicken/Beef", price: 5000 },
        { id: 2, name: "Double Chicken/Beef", price: 7000 }
      ],
      "SHAWARMA": [
        { id: 1, name: "Beef/Chicken", price: 3500 },
        { id: 2, name: "Jumbo", price: 5000 },
        { id: 3, name: "Extra Sausage/Chicken", price: 500 }
      ],
      "SANDWICH": [
        { id: 1, name: "Club Chicken/Beef", price: 3500 },
        { id: 2, name: "Philly Cheese/Chicken Melt", price: 7000 }
      ],
      "BEVERAGES": [
        { id: 1, name: "Fruity Zobo", price: 1500 },
        { id: 2, name: "Juices/Yoghurt", price: 2500 },
        { id: 3, name: "Greek Yoghurt 500ml", price: 5000 },
        { id: 4, name: "Greek Yoghurt 1L", price: 9500 },
        { id: 5, name: "Parfait 500ml", price: 6500 },
        { id: 6, name: "Parfait 1L", price: 12500 }
      ],
      "MILKSHAKES": [
        { id: 1, name: "All Flavors", price: 7000 }
      ],
      "PIZZA": [
        { id: 1, name: "Beef/Chicken/Margherita (S)", price: 6000 },
        { id: 2, name: "Beef/Chicken/Margherita (M)", price: 8000 },
        { id: 3, name: "Beef/Chicken/Margherita (L)", price: 10000 },
        { id: 4, name: "Pepperoni (S)", price: 7000 },
        { id: 5, name: "Pepperoni (M)", price: 9000 },
        { id: 6, name: "Pepperoni (L)", price: 11000 },
        { id: 7, name: "BBQ (S)", price: 8000 },
        { id: 8, name: "BBQ (M)", price: 10000 },
        { id: 9, name: "BBQ (L)", price: 12000 },
        { id: 10, name: "Supreme (S)", price: 10000 },
        { id: 11, name: "Supreme (M)", price: 13000 },
        { id: 12, name: "Supreme (L)", price: 16000 }
      ]
    }
  },
  "IMOLE_PATISSERIE": {
    name: "Imole’s Patisserie",
    address: "Imole's Patisserie",
    categories: {
      "BAKERY": [
        { id: 1, name: "Chicken Pie", price: 1000 },
        { id: 2, name: "Meatpie", price: 1000 },
        { id: 3, name: "Sausage Roll", price: 500 },
        { id: 4, name: "Full Sausage", price: 1000 },
        { id: 5, name: "Egg Roll", price: 500 },
        { id: 6, name: "Small Chops (Chicken)", price: 3500 },
        { id: 7, name: "Small Chops (Beef)", price: 2500 },
        { id: 8, name: "Doughnuts (Pack of 3)", price: 4500 },
        { id: 9, name: "Doughnuts (Pack of 6)", price: 8500 },
        { id: 10, name: "Cake Slice", price: 3000 }, // Avg price
        { id: 11, name: "Ice Cream Plate (S)", price: 1000 },
        { id: 12, name: "Ice Cream Plate (M)", price: 1500 },
        { id: 13, name: "Ice Cream Plate (L)", price: 2200 }
      ],
      "CAKES": [
        { id: 1, name: "Birthday 6inch", price: 15000 },
        { id: 2, name: "Birthday 8inch", price: 20000 },
        { id: 3, name: "Birthday 10inch", price: 25000 }
      ],
      "PARFAIT": [
        { id: 1, name: "Small", price: 3500 },
        { id: 2, name: "Big", price: 4500 }
      ]
    }
  },
  "FINEY_PRICES": {
    name: "Finey Prices",
    address: "Finey Prices",
    categories: {
      "RICE_PASTA": [
        { id: 1, name: "Rice/Pasta (Beef/Egg/Ponmo)", price: 1800 },
        { id: 2, name: "Rice/Pasta (Goat Meat)", price: 2300 },
        { id: 3, name: "Rice/Pasta (Fish/Chicken)", price: 2500 },
        { id: 4, name: "Rice/Pasta (Turkey)", price: 4250 }
      ],
      "NOODLES": [
        { id: 1, name: "Stirfry (Beef/Egg)", price: 1800 },
        { id: 2, name: "Fried Egg", price: 2000 },
        { id: 3, name: "Chicken", price: 3000 },
        { id: 4, name: "Fish", price: 2800 },
        { id: 5, name: "Turkey", price: 4750 }
      ],
      "OFADA_NATIVE": [
        { id: 1, name: "Beef", price: 2800 },
        { id: 2, name: "Goat Meat", price: 3200 },
        { id: 3, name: "Fish", price: 3500 },
        { id: 4, name: "Chicken", price: 4000 },
        { id: 5, name: "Turkey", price: 5250 }
      ],
      "PORRIDGE_PLANTAIN_YAM": [
        { id: 1, name: "Mini", price: 3000 },
        { id: 2, name: "Maxi", price: 4250 }
      ],
      "PEPPERED_SOUP": [
        { id: 1, name: "Gizdodo/Asun (S)", price: 2000 },
        { id: 2, name: "Gizdodo/Asun (L)", price: 5000 },
        { id: 3, name: "Snail (S)", price: 2500 },
        { id: 4, name: "Snail (L)", price: 5000 },
        { id: 5, name: "Ponmo (S)", price: 1500 },
        { id: 6, name: "Ponmo (L)", price: 3000 },
        { id: 7, name: "Protein & Plantain", price: 6500 } // Avg
      ]
    }
  },
  "ROYALS_TREAT": {
    name: "Royal’s Treat and Tidbits",
    address: "Royal's Treat",
    categories: {
      "MEALS": [
        { id: 1, name: "Stir Fry Spaghetti Chicken", price: 4500 },
        { id: 2, name: "Extra Plate Stir Fry", price: 5500 },
        { id: 3, name: "Yam and Egg Sauce", price: 4500 },
        { id: 4, name: "Basmati Jambalaya Rice & Turkey", price: 8500 },
        { id: 5, name: "Stir Spaghetti Chicken & Plantain", price: 5000 },
        { id: 6, name: "Basmati Rice and Gizzdodo", price: 7000 }
      ],
      "SNACKS": [
        { id: 1, name: "Small Chops", price: 4500 },
        { id: 2, name: "Chicken Pie", price: 1200 },
        { id: 3, name: "Meat Pie", price: 1200 },
        { id: 4, name: "Buns", price: 200 },
        { id: 5, name: "Doughnuts", price: 700 },
        { id: 6, name: "Egg Roll", price: 700 }
      ],
      "PARFAIT": [
        { id: 1, name: "Fruit Parfait", price: 4500 },
        { id: 2, name: "Cake Parfait", price: 3500 }
      ]
    }
  },
  "OKELE_JOINT": {
    name: "Okele Joint",
    address: "Okele Joint",
    categories: {
      "SWALLOW": [
        { id: 1, name: "Amala", price: 300 },
        { id: 2, name: "Pounded Yam", price: 500 },
        { id: 3, name: "Semo/Fufu/Eba/Tuwo", price: 200 }
      ],
      "PROTEIN": [
        { id: 1, name: "Cow Meat", price: 200 },
        { id: 2, name: "Goat Meat", price: 500 },
        { id: 3, name: "Fish (Small)", price: 1000 },
        { id: 4, name: "Fish (Big)", price: 2000 },
        { id: 5, name: "Wara", price: 300 },
        { id: 6, name: "Ponmo", price: 300 },
        { id: 7, name: "Cow Leg (Small)", price: 400 },
        { id: 8, name: "Cow Leg (Big)", price: 500 },
        { id: 9, name: "Chicken", price: 1500 },
        { id: 10, name: "Smoke Fish", price: 500 },
        { id: 11, name: "Hake Fish", price: 1000 }
      ]
    }
  },
  "IYA_AFUSAT": {
    name: "Iya Afusat Kitchen",
    address: "Iya Afusat",
    categories: {
      "MAIN_MEALS": [
        { id: 1, name: "Rice/Beans/Jollof/Spag/Bread", price: 750 }, // Avg
        { id: 2, name: "Plantain", price: 200 }
      ],
      "SWALLOW": [
        { id: 1, name: "Semo/Eba/Fufu/Iyan/Amala", price: 200 }
      ],
      "PROTEIN": [
        { id: 1, name: "Beef (Small)", price: 200 },
        { id: 2, name: "Beef (Big)", price: 500 },
        { id: 3, name: "Ponmo", price: 500 },
        { id: 4, name: "Titus", price: 1000 },
        { id: 5, name: "Wara", price: 500 },
        { id: 6, name: "Egg", price: 400 }
      ]
    }
  },
  "JAMBLACK_HUBS": {
    name: "Jamblack Hubs",
    address: "Jamblack Hubs",
    categories: {
      "SHAWARMA": [
        { id: 1, name: "Medium", price: 3500 },
        { id: 2, name: "Large", price: 5000 }
      ],
      "PASTA_MEALS": [
        { id: 1, name: "Spaghetti Chicken", price: 3500 },
        { id: 2, name: "Spaghetti Turkey", price: 5500 },
        { id: 3, name: "Penne Pasta Chicken", price: 4500 }
      ],
      "EXTRAS": [
        { id: 1, name: "Turkey", price: 6500 },
        { id: 2, name: "Toast Bread", price: 700 },
        { id: 3, name: "Beef", price: 500 },
        { id: 4, name: "Ponmo", price: 500 },
        { id: 5, name: "Sausage", price: 500 },
        { id: 6, name: "Plantain", price: 500 }
      ]
    }
  },
  "OPEYEMI_CANTEEN": {
    name: "Opeyemi Food Canteen",
    address: "Opeyemi Canteen",
    categories: {
      "SWALLOW": [
        { id: 1, name: "Pounded Yam", price: 600 },
        { id: 2, name: "Amala/Eba/Semo", price: 200 }
      ],
      "PROTEIN": [
        { id: 1, name: "Beef", price: 500 },
        { id: 2, name: "Turkey", price: 4000 },
        { id: 3, name: "Ponmo", price: 500 },
        { id: 4, name: "Titus", price: 2000 },
        { id: 5, name: "Wara", price: 500 }
      ],
      "SOUP": [
        { id: 1, name: "Soup (Free with Swallow)", price: 0 }
      ]
    }
  }
};

// Helper to map groups to vendor keys
const VENDOR_GROUPS = {
  "RESTAURANTS": ["BISSY_JOY", "BIG_MUMMY", "DEEMEALLAB", "SAVORE", "FINEY_PRICES", "OKELE_JOINT", "IYA_AFUSAT", "OPEYEMI_CANTEEN"],
  "SHAWARMA_FAST_FOOD": ["BIGGY_SHACK", "ROYAL_CHAW", "WRAP_STAR", "CHAO_COCINA", "SPAG_CITY", "JAMBLACK_HUBS", "ROYALS_TREAT"],
  "NOODLES_SNACKS": ["YK_NOODLES", "HOT_OOLE", "KRAFTY_KITCHEN", "IMOLE_PATISSERIE", "HD_TREATS"],
  "FROZEN_FOODS": ["TEE_JAY"],
  "PHARMACY": ["ZROF_PHARMACY"]
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
                msg = "⏳ *Rider Assigned*\n\nYour order has been accepted by a rider.\n\nDon't reply here. Contact the rider directly.";
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
      // --- NEW VENDOR FLOW ---
      case 'vendor_group_select':
        await handleVendorGroupSelect(from, parseInt(msg), twiml);
        break;
      case 'vendor_select':
        await handleVendorSelect(from, parseInt(msg), twiml);
        break;
      // -------------------------
      case 'category_select':
        await handleCategorySelect(from, msg, twiml);
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
        // Protein loop logic might need adjustment for vendors without specific protein categories
        // For now, we treat "Add more items" generally
        await handleAddMoreLoop(from, msg, twiml);
        break;
      case 'protein_select':
        await handleItemSelect(from, parseInt(msg), twiml); // Reuse item select
        break;
      case 'protein_size':
        await handleSizeSelect(from, msg, twiml); // Reuse size select
        break;
      case 'protein_qty':
        await handleQuantitySelect(from, msg, twiml); // Reuse qty select
        break;
      case 'add_more_or_checkout':
        if (msg === '1') {
           // Determine if vendor has categories to go back to, or just item list
           const vKey = user.selected_vendor;
           const vendor = VENDORS[vKey];
           const cats = Object.keys(vendor.categories);
           if(cats.length > 1) {
             await showCategories(from, twiml);
           } else {
             // If only one category, show items directly
             await db.ref(`users/${from}`).update({ step: 'item_select', current_category: cats[0] });
             await showItems(from, cats[0], twiml);
           }
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
  const welcomeMsg = `🍽️ *Welcome to ChowZone!*\n\nHow can we help you today?\n\n1. 🍽️ Order Food (Restaurants)\n2. 🌯 Shawarma & Snacks\n3. 🥶 Frozen Foods\n4. 💊 Pharmacy\n5. 🛒 Errands & Shopping\n\nReply with number 1-5.\n(Text 'Cancel' anytime to restart)`;
  twiml.message(welcomeMsg);
}

async function handleMainMenu(from, msg, twiml) {
  // 1. Restaurants, 2. Shawarma, 3. Frozen, 4. Pharmacy, 5. Errands
  if (msg === '1') {
    await db.ref(`users/${from}`).update({
      step: 'vendor_group_select',
      selected_group: 'RESTAURANTS',
      order_type: 'food'
    });
    await showVendorsInGroup(from, 'RESTAURANTS', twiml);
  } else if (msg === '2') {
    await db.ref(`users/${from}`).update({
      step: 'vendor_group_select',
      selected_group: 'SHAWARMA_FAST_FOOD',
      order_type: 'food'
    });
    await showVendorsInGroup(from, 'SHAWARMA_FAST_FOOD', twiml);
  } else if (msg === '3') {
    await db.ref(`users/${from}`).update({
      step: 'vendor_group_select',
      selected_group: 'FROZEN_FOODS',
      order_type: 'food'
    });
    await showVendorsInGroup(from, 'FROZEN_FOODS', twiml);
  } else if (msg === '4') {
    await db.ref(`users/${from}`).update({
      step: 'vendor_group_select',
      selected_group: 'PHARMACY',
      order_type: 'food'
    });
    await showVendorsInGroup(from, 'PHARMACY', twiml);
  } else if (msg === '5') {
    await db.ref(`users/${from}`).update({
      step: 'errand_type',
      order_type: 'errand'
    });
    twiml.message(`🏃 *Select Errand Type*\n\n1. 🛒 Market Shopping\n2. 📦 Pick Up Item\n3. 📝 Campus Task\n\nReply with number.`);
  } else {
    twiml.message("Invalid option. Reply 1, 2, 3, 4, or 5.");
  }
}

async function showVendorsInGroup(from, groupKey, twiml) {
  const vendorKeys = VENDOR_GROUPS[groupKey];
  let msg = `🏪 *Select ${groupKey.replace('_', ' ')}*\n\n`;
  
  vendorKeys.forEach((vKey, index) => {
    msg += `${index + 1}. ${VENDORS[vKey].name}\n`;
  });
  
  msg += `\nReply number.`;
  twiml.message(msg);
}

async function handleVendorGroupSelect(from, choice, twiml) {
  const groupKey = VENDOR_GROUPS[from]; // This logic was wrong, fetching from DB
  // Let's fix: we stored selected_group in DB
  const userSnap = await db.ref(`users/${from}`).once('value');
  const user = userSnap.val();
  const groupKey = user.selected_group;
  const vendorKeys = VENDOR_GROUPS[groupKey];

  if (choice < 1 || choice > vendorKeys.length) {
    return twiml.message("Invalid selection.");
  }

  const selectedVendorKey = vendorKeys[choice - 1];
  
  await db.ref(`users/${from}`).update({
    step: 'category_select',
    selected_vendor: selectedVendorKey
  });

  // Check if vendor has categories
  const vendor = VENDORS[selectedVendorKey];
  const categories = Object.keys(vendor.categories);

  if (categories.length === 1 && categories[0] === 'MENU') {
    // Flat list, skip category selection
    await showItems(from, 'MENU', twiml);
  } else {
    await showCategories(from, twiml);
  }
}

async function showCategories(from, twiml) {
  const userSnap = await db.ref(`users/${from}`).once('value');
  const user = userSnap.val();
  const vKey = user.selected_vendor;
  const vendor = VENDORS[vKey];
  const categories = Object.keys(vendor.categories);

  await db.ref(`users/${from}/step`).set('category_select');
  
  let msg = `📂 *${vendor.name} Categories*\n\n`;
  categories.forEach((cat, index) => {
    msg += `${index + 1}. ${cat.replace(/_/g, ' ')}\n`;
  });
  msg += `\nReply number.`;
  twiml.message(msg);
}

async function handleCategorySelect(from, msg, twiml) {
  const userSnap = await db.ref(`users/${from}`).once('value');
  const user = userSnap.val();
  const vKey = user.selected_vendor;
  const vendor = VENDORS[vKey];
  const categories = Object.keys(vendor.categories);
  
  const choice = parseInt(msg);

  if (isNaN(choice) || choice < 1 || choice > categories.length) {
    return twiml.message("Invalid category. Try again.");
  }

  const selectedCat = categories[choice - 1];
  
  await db.ref(`users/${from}`).update({
    step: 'item_select',
    current_category: selectedCat
  });

  await showItems(from, selectedCat, twiml);
}

async function showItems(from, catKey, twiml) {
  const userSnap = await db.ref(`users/${from}`).once('value');
  const user = userSnap.val();
  const vKey = user.selected_vendor;
  const items = VENDORS[vKey].categories[catKey];

  let msg = `*${catKey.replace(/_/g, ')}*\n\n`;
  items.forEach(item => {
    let priceTxt = "";
    if (item.reg && item.ext) {
        priceTxt = (item.reg === item.ext) ? formatCurrency(item.reg) : `${formatCurrency(item.reg)} / ${formatCurrency(item.ext)}`;
    } else {
        priceTxt = formatCurrency(item.price);
    }
    msg += `${item.id}. ${item.name} - ${priceTxt}\n`;
  });
  msg += `\nReply item number.`;
  twiml.message(msg);
}

async function handleItemSelect(from, id, twiml) {
  const userSnap = await db.ref(`users/${from}`).once('value');
  const user = userSnap.val();
  const vKey = user.selected_vendor;
  const cat = user.current_category;
  const item = VENDORS[vKey].categories[cat].find(i => i.id === id);

  if (!item) return twiml.message("Invalid item number.");
  
  await db.ref(`users/${from}`).update({
    step: 'size_select',
    selected_item: item
  });

  // Check if sizes are needed
  if (item.reg && item.ext && item.reg !== item.ext) {
    let msg = `*${item.name}*\n\nSelect Portion:\n1. Regular (${formatCurrency(item.reg)})\n2. Extra (${formatCurrency(item.ext)})\n\nReply 1 or 2.`;
    twiml.message(msg);
  } else {
    // No size choice, go to quantity
    let price = item.price || item.reg || item.ext;
    let size = "Regular";
    if (!item.price && !item.reg) price = 0; // Safety

    await db.ref(`users/${from}`).update({
        step: 'quantity_select',
        selected_item_price: price,
        selected_size: size
    });
    twiml.message(`*${item.name}*\n\nPrice: ${formatCurrency(price)}\n\nHow many? (Enter number)`);
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
  const price = user.selected_item_price;
  const size = user.selected_size;

  const newItem = {
    name: item.name,
    price: price,
    qty: qty,
    size: size,
    type: 'main'
  };

  const cart = user.cart || [];
  cart.push(newItem);

  // Logic to check if we should ask for protein/sides specifically?
  // Since vendors have different structures, we will simplify:
  // Add to cart -> Ask "Add more items?" or "Checkout"

  await db.ref(`users/${from}`).update({ cart: cart });
  await showCartSummary(from, cart, twiml);
}

async function handleAddMoreLoop(from, msg, twiml) {
    // Reuse showCartSummary logic logic or simplify
    const userSnap = await db.ref(`users/${from}`).once('value');
    const user = userSnap.val();
    
    if (msg === '1') {
       // Back to categories or items
       const vKey = user.selected_vendor;
       const vendor = VENDORS[vKey];
       const cats = Object.keys(vendor.categories);
       if(cats.length > 1) {
         await showCategories(from, twiml);
       } else {
         await showItems(from, cats[0], twiml);
       }
    } else if (msg === '2') {
       await db.ref(`users/${from}`).update({ step: 'customer_name' });
       twiml.message("📝 Please provide your Full Name.");
    } else {
       twiml.message("Reply 1 or 2.");
    }
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
  txt += `Do you want to add another item?\n1. Yes\n2. No (Proceed to Delivery)`;

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
  else if (type === 3) { typeStr = "TASK"; isPickup = true; }
  else return twiml.message("Invalid selection.");

  await db.ref(`users/${from}`).update({
    errand_type: typeStr,
    needs_shopping: needsShopping,
    is_pickup: isPickup
  });

  if (isPickup) {
    await db.ref(`users/${from}/step`).set('pickup_description');
    twiml.message("📝 *Describe the task or pickup details:*\n(e.g., Get a bag of drink at Tarmac)");
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
    const vKey = user.selected_vendor;

    if (user.order_type === 'food' && vKey) {
        const vendor = VENDORS[vKey];
        twiml.message(`📍 *Where is the Pickup Location?*\n\n1. ${vendor.name} (Default)\n2. Type a different address\n\nReply 1 or 2.`);
    } else {
        twiml.message("📍 *Where is the Pickup Location?*\n\n(e.g. Tarmac, School Road, Westend, Safari)");
    }
}

async function handlePickupLocation(from, text, twiml) {
    const userSnap = await db.ref(`users/${from}`).once('value');
    const user = userSnap.val();
    let location = text;
    const vKey = user.selected_vendor;

    if (user.order_type === 'food' && vKey && text.trim() === '1') {
        location = VENDORS[vKey].address;
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

async function handlePickupLocationManual(from, text, twiml) {
    if(!text) return twiml.message("Address required.");
    await handlePickupLocation(from, text, twiml); // Pass through
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

    if (user.selected_vendor) {
        summary += `🏪 Vendor: ${VENDORS[user.selected_vendor].name}\n\n`;
    } else if (user.vendor_name) {
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
  let vendorName = "Errand/General";

  if (user.selected_vendor) {
      vendorName = VENDORS[user.selected_vendor].name;
      if (user.cart) {
          orderDetails = user.cart;
      }
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
    vendor_name: vendorName,
    type: user.order_type,
    status: 'pending_payment',
    total: total,
    delivery_loc: user.delivery_location,
    pickup_loc: user.pickup_location,
    details: orderDetails,
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
    if (user.order_type === 'food' && user.cart) {
      user.cart.forEach(c => itemsList += `- ${c.name} (${c.size}) x${c.qty}\n`);
    } else {
      if (user.errand_items) {
          user.errand_items.forEach(i => itemsList += `- ${i.name}\n`);
      } else {
          itemsList += `- ${user.errand_description}\n`;
      }
    }

    const adminMsg = `💳 *NEW PAYMENT ALERT*\n\n` +
                    `Order ID: #${orderId}\n` +
                    `Vendor: ${vendorName}\n` +
                    `Type: ${user.order_type.toUpperCase()}\n` +
                    `Customer: ${user.customer_name}\n` +
                    `Phone: ${user.customer_phone}\n` +
                    `Pickup: ${user.pickup_location}\n` +
                    `Delivery: ${user.delivery_location}\n` +
                    `Total: ${formatCurrency(total)}\n\n` +
                    `Items:\n${itemsList}` +
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
  if (order.details) {
      order.details.forEach(d => itemsSummary += `${d.name} x${d.qty || 1}, `);
      itemsSummary = itemsSummary.slice(0, -2);
  }

  let msg = `🛵 NEW JOB #${orderId}\n`;
  msg += `Customer: ${order.customer_name}\n`;
  msg += `Phone: ${order.customer_phone}\n`;
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
