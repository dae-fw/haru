// Deterministic grocery aisle sorting — no AI. First keyword that appears as a
// substring of the item name wins; unmatched items go to "Other".

export const GROCERY_ORDER = [
  "Produce",
  "Bakery",
  "Meat & fish",
  "Dairy & eggs",
  "Frozen",
  "Pantry",
  "Snacks",
  "Drinks",
  "Household",
  "Other",
] as const;

export type GroceryCategory = (typeof GROCERY_ORDER)[number];

const KEYWORDS: Record<Exclude<GroceryCategory, "Other">, string[]> = {
  Produce: [
    "apple", "banana", "orange", "lemon", "lime", "grape", "berry", "berries",
    "strawberr", "blueberr", "raspberr", "melon", "mango", "pear", "peach",
    "avocado", "tomato", "potato", "onion", "garlic", "ginger", "carrot",
    "celery", "lettuce", "spinach", "kale", "cabbage", "broccoli", "cauliflower",
    "pepper", "cucumber", "zucchini", "mushroom", "corn", "pea", "bean sprout",
    "herb", "cilantro", "parsley", "basil", "scallion", "leek", "salad",
    "fruit", "veg",
  ],
  Bakery: [
    "bread", "bun", "bagel", "roll", "baguette", "croissant", "tortilla",
    "pita", "muffin", "cake", "pastry", "donut", "doughnut", "loaf",
  ],
  "Meat & fish": [
    "chicken", "beef", "pork", "lamb", "turkey", "bacon", "sausage", "ham",
    "steak", "mince", "ground beef", "meat", "fish", "salmon", "tuna",
    "shrimp", "prawn", "cod", "tilapia", "crab", "squid", "seafood",
  ],
  "Dairy & eggs": [
    "milk", "cheese", "butter", "yogurt", "yoghurt", "cream", "egg",
    "sour cream", "cottage", "mozzarella", "cheddar", "parmesan", "feta",
    "kefir", "margarine",
  ],
  Frozen: [
    "frozen", "ice cream", "gelato", "popsicle", "fish stick", "frozen pizza",
    "peas frozen", "nugget",
  ],
  Pantry: [
    "rice", "pasta", "noodle", "flour", "sugar", "salt", "oil", "olive oil",
    "vinegar", "soy sauce", "ketchup", "mustard", "mayo", "mayonnaise",
    "cereal", "oat", "oatmeal", "honey", "jam", "peanut butter", "nutella",
    "can ", "canned", "tin ", "tomato sauce", "stock", "broth", "spice",
    "baking", "yeast", "lentil", "chickpea", "coconut milk", "curry paste",
    "tea", "coffee", "cocoa", "syrup", "cornstarch", "breadcrumb", "seed",
    "nut", "almond", "cashew", "walnut", "raisin", "dried",
  ],
  Snacks: [
    "chip", "crisp", "cracker", "biscuit", "cookie", "popcorn", "pretzel",
    "candy", "chocolate", "granola bar", "snack", "gum", "trail mix",
  ],
  Drinks: [
    "water", "juice", "soda", "cola", "sparkling", "beer", "wine",
    "kombucha", "energy drink", "sports drink", "lemonade", "drink",
  ],
  Household: [
    "paper towel", "toilet paper", "tissue", "napkin", "detergent", "soap",
    "shampoo", "conditioner", "toothpaste", "deodorant", "sponge", "bleach",
    "dish soap", "trash bag", "bin bag", "foil", "cling film", "plastic wrap",
    "battery", "light bulb", "cleaner", "wipes", "razor", "floss", "sanitizer",
    "laundry", "fabric softener", "diaper", "nappy", "litter",
  ],
};

export function categorize(name: string): GroceryCategory {
  const n = name.toLowerCase();
  for (const cat of GROCERY_ORDER) {
    if (cat === "Other") continue;
    const words = KEYWORDS[cat];
    if (words.some((w) => n.includes(w))) return cat;
  }
  return "Other";
}
