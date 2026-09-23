// Expands the storefront catalog with more categories, independent shops, and products.
// Idempotent: categories and products are upserted by slug, shops by email. Run with `npm run db:seed:catalog`.
import { randomBytes } from 'node:crypto';
import { PrismaClient, ProductStatus, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const photo = (id: string, width = 1000) => `https://images.unsplash.com/photo-${id}?w=${width}`;
// Spread listing dates over three weeks (deterministic per slug) so "newest" feeds look like a living shop.
const CATALOG_DATE = Date.parse('2026-09-24T09:00:00Z');
const listedAt = (slug: string) => {
  const hash = [...slug].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 7);
  return new Date(CATALOG_DATE - (hash % (21 * 24 * 60)) * 60_000);
};

const categories = [
  { name: 'Kitchen & Dining', slug: 'kitchen-dining', description: 'Cookware, coffee, and pantry favourites', imageUrl: photo('1590794056226-79ef3a8147e1', 900) },
  { name: 'Sports & Outdoors', slug: 'sports-outdoors', description: 'Gear for trails, beaches, and the gym', imageUrl: photo('1504280390367-361c6d9f38f4', 900) },
  { name: 'Books & Stationery', slug: 'books-stationery', description: 'Good reads and tools for writing them down', imageUrl: photo('1507842217343-583bb7270b66', 900) },
  { name: 'Handmade & Crafts', slug: 'handmade-crafts', description: 'Made by hand in studios across Egypt', imageUrl: photo('1493106641515-6b5631de4bb9', 900) },
];

// Shop accounts get an unguessable random password; they exist to own listings, not to sign in.
const shops = [
  { key: 'delta', email: 'hello@deltakitchen.shop', username: 'delta_kitchen', displayName: 'Delta Kitchen Co.', bio: 'Cookware, specialty coffee, and pantry staples chosen by home cooks from the Nile Delta.' },
  { key: 'sinai', email: 'team@sinaioutfitters.shop', username: 'sinai_outfitters', displayName: 'Sinai Outfitters', bio: 'Gear for Sinai trails, Red Sea mornings, and city runs. Tested on the mountains we sell for.' },
  { key: 'papyrus', email: 'hello@papyrusandink.shop', username: 'papyrus_and_ink', displayName: 'Papyrus & Ink', bio: 'Notebooks, pens, and good reads for curious minds. A small shop run by two Alexandrian booksellers.' },
  { key: 'fayoum', email: 'studio@fayoumclay.shop', username: 'fayoum_clay', displayName: 'Fayoum Clay Studio', bio: 'Hand-thrown pottery and home goods from Tunis Village, Fayoum. Every piece is made and glazed by hand.' },
  { key: 'tech', email: 'sales@cairotechhub.shop', username: 'cairo_tech_hub', displayName: 'Cairo Tech Hub', bio: 'Genuine electronics with local warranty, shipped from our Heliopolis warehouse.' },
  { key: 'zamalek', email: 'hello@zamalekthreads.shop', username: 'zamalek_threads', displayName: 'Zamalek Threads', bio: 'Everyday clothing, shoes, and bags with a clean, modern cut. Designed in Cairo.' },
  { key: 'siwa', email: 'care@siwanaturals.shop', username: 'siwa_naturals', displayName: 'Siwa Naturals', bio: 'Small-batch skincare built on oils and botanicals from the Siwa Oasis.' },
  { key: 'nile', email: 'seller@bazaarnile.com', username: 'nile_select', displayName: 'Nile Select', bio: 'Curated essentials from trusted makers.' },
] as const;

type Listing = {
  name: string; slug: string; description: string; price: number; compareAt?: number;
  images: string[]; category: string; shop: (typeof shops)[number]['key']; inventory: number; featured?: boolean;
};

const products: Listing[] = [
  // Kitchen & Dining
  { name: 'Enameled Cast-Iron Casserole, 4.7 L', slug: 'enameled-cast-iron-casserole', description: 'A heavy enameled cast-iron pot that holds heat evenly for slow-cooked molokhia, stews, and fresh bread. Oven-safe to 250°C and works on gas, electric, and induction hobs.', price: 3299, compareAt: 3899, images: ['1590794056226-79ef3a8147e1'], category: 'kitchen-dining', shop: 'delta', inventory: 14, featured: true },
  { name: 'Single-Origin Ethiopian Coffee, 250 g', slug: 'single-origin-ethiopian-coffee', description: 'Washed Yirgacheffe beans roasted in Cairo every Sunday. Bright citrus and jasmine notes with a clean, tea-like finish. Choose whole bean or ask for a grind in the order notes.', price: 420, images: ['1517668808822-9ebb02f2a0e6'], category: 'kitchen-dining', shop: 'delta', inventory: 60 },
  { name: 'House Espresso Roast, 1 kg', slug: 'house-espresso-roast', description: 'A chocolatey medium-dark blend of Brazilian and Indian beans, built for espresso machines and moka pots alike. Roasted weekly and sealed with a one-way valve.', price: 1250, compareAt: 1400, images: ['1559056199-641a0ac8b55e'], category: 'kitchen-dining', shop: 'delta', inventory: 35 },
  { name: 'Stoneware Mug & Coaster Set', slug: 'stoneware-mug-coaster-set', description: 'A generous 350 ml stoneware mug with a matching cork-backed coaster. Dishwasher and microwave safe, with a glaze that keeps its colour wash after wash.', price: 390, images: ['1544787219-7f47ccb76574'], category: 'kitchen-dining', shop: 'delta', inventory: 42 },
  { name: 'Aswan Hibiscus & Herbal Tea Blend', slug: 'aswan-hibiscus-herbal-tea', description: 'Sun-dried karkadeh from Aswan blended with lemongrass and dried rose petals. Brew hot in winter or pour over ice in summer. 150 g resealable pouch, about 50 cups.', price: 185, images: ['1571934811356-5cc061b6821f'], category: 'kitchen-dining', shop: 'delta', inventory: 80 },
  { name: 'Loose-Leaf Tea Sampler, 6 Blends', slug: 'loose-leaf-tea-sampler', description: 'Six 30 g tins to find your favourite: Ceylon black, jasmine green, chamomile, mint, sage, and a cardamom chai. A thoughtful gift for tea lovers.', price: 360, images: ['1563822249548-9a72b6353cd1'], category: 'kitchen-dining', shop: 'delta', inventory: 25 },
  { name: 'Spice Market Discovery Kit', slug: 'spice-market-discovery-kit', description: 'Seven essential spices from Cairo’s old spice market, including cumin, sumac, smoked paprika, and dukkah, each in a 60 g jar with a recipe card for every blend.', price: 480, images: ['1506368249639-73a05d6f6488'], category: 'kitchen-dining', shop: 'delta', inventory: 30, featured: true },
  { name: 'Whole Spice Pantry Starter', slug: 'whole-spice-pantry-starter', description: 'Cinnamon bark, cloves, star anise, black peppercorns, cardamom pods, and dried chillies. Everything a new kitchen needs to cook with whole spices.', price: 540, images: ['1596040033229-a9821ebd058d'], category: 'kitchen-dining', shop: 'delta', inventory: 3 },
  { name: 'Cappuccino Cups, Set of 2', slug: 'cappuccino-cups-set-of-2', description: 'Thick-walled 180 ml porcelain cups that keep milk drinks hot and give latte art room to shine. Pre-warm them for the best crema.', price: 450, images: ['1495474472287-4d71bcdd2085', '1509042239860-f550ce710b93'], category: 'kitchen-dining', shop: 'delta', inventory: 18 },
  { name: 'Stainless Milk Frothing Pitcher, 600 ml', slug: 'stainless-milk-frothing-pitcher', description: 'A sharp-spouted steel pitcher for steaming milk and pouring clean latte art. Inside measurement lines take the guesswork out of every drink.', price: 340, images: ['1541167760496-1628856ab772'], category: 'kitchen-dining', shop: 'delta', inventory: 22 },
  { name: 'Speckled Stoneware Dinner Plates, Set of 4', slug: 'speckled-stoneware-dinner-plates', description: 'Wide-rimmed 27 cm plates with a soft sky-blue glaze and natural speckling. Chip-resistant and stackable for everyday family dinners.', price: 1150, images: ['1578749556568-bc2c40e68b61'], category: 'kitchen-dining', shop: 'fayoum', inventory: 12 },

  // Sports & Outdoors
  { name: 'Two-Person Dome Tent', slug: 'two-person-dome-tent', description: 'A quick-pitch dome tent with a waterproof fly, mesh ceiling for stargazing in Wadi Rum or Saint Catherine, and two doors so nobody climbs over anyone. Packs to 2.3 kg.', price: 4299, compareAt: 4999, images: ['1504280390367-361c6d9f38f4'], category: 'sports-outdoors', shop: 'sinai', inventory: 9, featured: true },
  { name: '45 L Trekking Backpack', slug: '45l-trekking-backpack', description: 'A ventilated back panel, adjustable torso length, and a hip belt that carries weight properly on multi-day hikes. Includes a rain cover and hydration sleeve.', price: 2899, compareAt: 3300, images: ['1622260614153-03223fb72052'], category: 'sports-outdoors', shop: 'sinai', inventory: 16 },
  { name: 'Insulated Steel Water Bottle, 750 ml', slug: 'insulated-steel-water-bottle', description: 'Double-wall vacuum insulation keeps water cold for 24 hours in the Egyptian summer, or tea hot for 12. Leak-proof lid and a powder-coated grip.', price: 549, images: ['1602143407151-7111542de6e8'], category: 'sports-outdoors', shop: 'sinai', inventory: 70, featured: true },
  { name: 'Non-Slip Yoga Mat, 6 mm', slug: 'non-slip-yoga-mat', description: 'Dense natural-rubber mat with a grippy top layer that holds steady even in hot yoga. Comes with a cotton carrying strap. 183 × 61 cm.', price: 799, images: ['1601925260368-ae2f83cf8b7f', '1592432678016-e910b452f9a2', '1544367567-0f2fcb009e0b'], category: 'sports-outdoors', shop: 'sinai', inventory: 40 },
  { name: 'Single-Speed City Bicycle', slug: 'single-speed-city-bicycle', description: 'A light steel-frame bike with a flip-flop hub, leather-look saddle, and puncture-resistant tyres. Delivered 90% assembled with the tools you need.', price: 12500, images: ['1485965120184-e220f721d03e'], category: 'sports-outdoors', shop: 'sinai', inventory: 4 },
  { name: 'Olympic Barbell & Plate Set, 60 kg', slug: 'olympic-barbell-plate-set', description: 'A 20 kg knurled Olympic bar with 40 kg of rubber-coated plates and spring collars. Everything you need to start lifting at home.', price: 6999, images: ['1517836357463-d25dfeac3438'], category: 'sports-outdoors', shop: 'sinai', inventory: 0 },
  { name: 'Lightweight Running Shoes', slug: 'lightweight-running-shoes', description: 'Breathable knit uppers and a responsive foam midsole for daily runs along the Corniche. Weighs just 240 g per shoe.', price: 2450, compareAt: 2890, images: ['1491553895911-0055eca6402d'], category: 'sports-outdoors', shop: 'sinai', inventory: 28 },

  // Books & Stationery
  { name: 'A5 Dotted Spiral Notebook', slug: 'a5-dotted-spiral-notebook', description: '160 pages of 100 gsm dotted paper that takes fountain pen ink without bleeding. Lies flat, with a sturdy recycled board cover.', price: 145, images: ['1531346878377-a5be20888e57'], category: 'books-stationery', shop: 'papyrus', inventory: 120 },
  { name: 'Fountain Pen Gift Set', slug: 'fountain-pen-gift-set', description: 'A brass fountain pen with a fine steel nib, a converter, and five ink cartridges, presented in a gift box. A classic present for graduations.', price: 650, compareAt: 780, images: ['1455390582262-044cdead277a', '1517842645767-c639042777db'], category: 'books-stationery', shop: 'papyrus', inventory: 15, featured: true },
  { name: 'Matte Black Gel Pens, 5-Pack', slug: 'matte-black-gel-pens', description: 'Smooth 0.5 mm quick-drying gel ink in a soft-touch matte barrel. The pen you keep reaching for.', price: 120, images: ['1583485088034-697b5bc54ccd'], category: 'books-stationery', shop: 'papyrus', inventory: 200 },
  { name: 'Colour Studio Stationery Bundle', slug: 'colour-studio-stationery-bundle', description: 'Highlighters, fine-liners, sticky notes, and markers in one box. Great for students, planners, and anyone who likes colour-coded notes.', price: 450, images: ['1456735190827-d1262f71b8a3'], category: 'books-stationery', shop: 'papyrus', inventory: 34 },
  { name: 'Weekend Fiction Bundle, 3 Paperbacks', slug: 'weekend-fiction-bundle', description: 'Three staff-picked novels, a mix of classics and new voices, chosen for you and wrapped in brown paper. Tell us what you have read in the order notes and we will avoid repeats.', price: 520, images: ['1544716278-ca5e3f4abd8c'], category: 'books-stationery', shop: 'papyrus', inventory: 20 },
  { name: 'Startup Founder’s Reading Stack', slug: 'startup-founders-reading-stack', description: 'Five well-known books on building companies, from finding an idea to growing a team. Paperback editions in English.', price: 1450, images: ['1512820790803-83ca734da794'], category: 'books-stationery', shop: 'papyrus', inventory: 8 },

  // Handmade & Crafts
  { name: 'Hand-Thrown Fayoum Clay Vase', slug: 'hand-thrown-fayoum-clay-vase', description: 'Thrown on the wheel in Tunis Village and fired in a wood kiln, so no two are the same. About 22 cm tall. Seal the inside before using with fresh flowers.', price: 690, images: ['1493106641515-6b5631de4bb9'], category: 'handmade-crafts', shop: 'fayoum', inventory: 7, featured: true },
  { name: 'Matte Stoneware Bud Vases, Set of 3', slug: 'matte-stoneware-bud-vases', description: 'Three slim vases in graduated heights with a chalky grey finish. Beautiful with dried palm, pampas, or a single stem.', price: 780, images: ['1565193566173-7a0ee3dbe261'], category: 'handmade-crafts', shop: 'fayoum', inventory: 11 },
  { name: 'Hand-Poured Soy Candle, Oud & Amber', slug: 'hand-poured-soy-candle-oud-amber', description: 'Clean-burning soy wax scented with oud, amber, and a touch of vanilla, poured by hand into a reusable glass. Burns for about 45 hours.', price: 320, images: ['1603006905003-be475563bc59'], category: 'handmade-crafts', shop: 'fayoum', inventory: 48 },
  { name: 'Patterned Wool Area Rug, 160 × 230 cm', slug: 'patterned-wool-area-rug', description: 'A soft wool-blend rug with a traditional medallion pattern in muted gold and blue, woven on looms in Kerdasa. Brings warmth to living rooms and bedrooms.', price: 7800, compareAt: 9200, images: ['1600166898405-da9535204843'], category: 'handmade-crafts', shop: 'fayoum', inventory: 5 },

  // Electronics
  { name: 'Wireless Earbuds with ANC', slug: 'wireless-earbuds-anc', description: 'Active noise cancelling, transparency mode, and 28 hours of total battery with the wireless charging case. Sweat-resistant for workouts.', price: 2299, compareAt: 2699, images: ['1572569511254-d8f925fe2cbb'], category: 'electronics', shop: 'tech', inventory: 30, featured: true },
  { name: 'Sport Earbuds with Ear Hooks', slug: 'sport-earbuds-ear-hooks', description: 'Secure-fit ear hooks and IPX5 water resistance keep these in place on runs and rides. 8 hours per charge.', price: 1299, images: ['1606220588913-b3aacb4d2f46'], category: 'electronics', shop: 'tech', inventory: 26 },
  { name: '14-inch Ultrabook, 16 GB / 512 GB', slug: '14-inch-ultrabook', description: 'A 1.3 kg aluminium laptop with an all-day battery, a sharp 2.2K display, 16 GB RAM, and a 512 GB SSD. Ships with Windows 11 and a one-year local warranty.', price: 32999, images: ['1496181133206-80ce9b88a853', '1593642632559-0c6d3fc62b89'], category: 'electronics', shop: 'tech', inventory: 6 },
  { name: 'Silent Wireless Mouse', slug: 'silent-wireless-mouse', description: 'Near-silent clicks, a comfortable contoured shape, and a tiny USB receiver that stores inside the mouse. Up to 18 months on one AA battery.', price: 449, images: ['1527864550417-7fd91fc51a46'], category: 'electronics', shop: 'tech', inventory: 90 },
  { name: '11-inch Tablet with Stylus Support', slug: '11-inch-tablet', description: 'A bright 11-inch display for reading, drawing, and streaming, with 128 GB storage and stylus support for handwritten notes.', price: 14999, compareAt: 16499, images: ['1544244015-0df4b3ffc6b0'], category: 'electronics', shop: 'tech', inventory: 10 },
  { name: 'Android Smartphone, 256 GB', slug: 'android-smartphone-256gb', description: 'A 6.2-inch OLED display, a triple camera with night mode, and 256 GB of storage. Dual SIM, with a one-year local warranty.', price: 18999, images: ['1610945265064-0e34e5519bbf'], category: 'electronics', shop: 'tech', inventory: 12 },
  { name: 'Studio Monitor Headphones', slug: 'studio-monitor-headphones', description: 'Closed-back wired headphones with a flat, honest sound for mixing, podcasting, and focused listening. Detachable 3 m cable.', price: 1799, images: ['1583394838336-acd977736f90'], category: 'electronics', shop: 'tech', inventory: 19 },

  // Fashion
  { name: 'Suede Bomber Jacket', slug: 'suede-bomber-jacket', description: 'A soft faux-suede bomber in a warm rust colour with ribbed cuffs and a quilted lining. Right for Cairo’s cool winter evenings.', price: 2899, compareAt: 3400, images: ['1591047139829-d91aecb6caea'], category: 'fashion', shop: 'zamalek', inventory: 14, featured: true },
  { name: 'Floral Print Stiletto Heels', slug: 'floral-print-stiletto-heels', description: 'Pointed-toe heels in a bold floral print with a 9 cm heel and a cushioned insole for weddings and evenings out.', price: 1650, images: ['1543163521-1bf539c55dd2'], category: 'fashion', shop: 'zamalek', inventory: 9 },
  { name: 'Structured Top-Handle Bag', slug: 'structured-top-handle-bag', description: 'A polished red top-handle bag with a detachable shoulder strap, a turn-lock closure, and room for a phone, wallet, and keys.', price: 3450, images: ['1584917865442-de89df76afd3'], category: 'fashion', shop: 'zamalek', inventory: 7 },
  { name: 'Graphic Cotton Tee', slug: 'graphic-cotton-tee', description: 'A heavyweight 220 gsm cotton T-shirt with a bold screen-printed graphic. Relaxed fit that holds its shape after washing.', price: 450, images: ['1576566588028-4147f3842f27'], category: 'fashion', shop: 'zamalek', inventory: 55 },
  { name: 'Essential White T-Shirts, 3-Pack', slug: 'essential-white-tshirts-3-pack', description: 'Three crew-neck tees in soft Egyptian cotton. The kind of white T-shirt you wear every day and replace only when you must.', price: 690, images: ['1521572163474-6864f9cf17ab'], category: 'fashion', shop: 'zamalek', inventory: 80 },
  { name: 'Tailored Oxford Shirt', slug: 'tailored-oxford-shirt', description: 'A crisp Oxford-weave cotton shirt with a button-down collar and a tailored fit. Available in white, light blue, and burgundy.', price: 890, images: ['1602810318383-e386cc2a3ccf'], category: 'fashion', shop: 'zamalek', inventory: 38 },
  { name: 'Retro Runner Sneakers', slug: 'retro-runner-sneakers', description: 'Chunky retro runners with suede overlays and pops of colour. A cushioned sole for all-day wear around the city.', price: 2150, images: ['1560769629-975ec94e6a86'], category: 'fashion', shop: 'zamalek', inventory: 2 },
  { name: 'Fleece Jogger Set', slug: 'fleece-jogger-set', description: 'A cropped hoodie and matching joggers in brushed fleece, in a sunny marigold yellow. Relaxed, warm, and easy to wear.', price: 1590, images: ['1515886657613-9f3515b0c78f'], category: 'fashion', shop: 'zamalek', inventory: 21 },

  // Beauty
  { name: 'Siwa Olive & Argan Facial Oil', slug: 'siwa-olive-argan-facial-oil', description: 'Cold-pressed Siwa olive oil blended with argan and rosehip to nourish dry skin overnight. 30 ml amber glass dropper bottle.', price: 650, images: ['1608571423902-eed4a5ad8108'], category: 'beauty', shop: 'siwa', inventory: 33, featured: true },
  { name: 'Natural Skincare Ritual Set', slug: 'natural-skincare-ritual-set', description: 'A gentle cleanser, toning mist, face oil, and clay mask for a complete weekly routine. Every product is fragrance-free and made in small batches.', price: 1450, compareAt: 1700, images: ['1612817288484-6f916006741a'], category: 'beauty', shop: 'siwa', inventory: 17 },
  { name: 'Botanical Hair Care Trio', slug: 'botanical-hair-care-trio', description: 'A hemp-seed hair oil, a sulfate-free shampoo, and a deep-conditioning mask to repair dry, heat-styled hair.', price: 890, images: ['1611930022073-b7a4ba5fcccd'], category: 'beauty', shop: 'siwa', inventory: 24 },
  { name: 'Rose Quartz Gua Sha Kit', slug: 'rose-quartz-gua-sha-kit', description: 'A rose quartz gua sha stone, a mini facial roller, and a calming face serum to use with them. Includes a step-by-step massage guide.', price: 620, images: ['1600428877878-1a0fd85beda8'], category: 'beauty', shop: 'siwa', inventory: 29 },

  // Home & Living
  { name: 'Emerald Velvet Three-Seater Sofa', slug: 'emerald-velvet-three-seater-sofa', description: 'Deep emerald velvet over a solid beech frame, with plush foam cushions and slim wooden legs. Delivered and assembled free in Greater Cairo.', price: 18500, compareAt: 21000, images: ['1555041469-a586c61ea9bc'], category: 'home-living', shop: 'nile', inventory: 4, featured: true },
  { name: 'Mustard Accent Armchair', slug: 'mustard-accent-armchair', description: 'A compact wingback armchair in mustard woven fabric that brightens a reading corner. Seat height 45 cm.', price: 6450, images: ['1586023492125-27b2c045efd7'], category: 'home-living', shop: 'nile', inventory: 8 },
  { name: 'Terracotta Two-Seater Sofa', slug: 'terracotta-two-seater-sofa', description: 'A cosy loveseat in terracotta textured fabric with removable, washable cushion covers. Right-sized for apartments and balconies.', price: 12900, images: ['1567016432779-094069958ea5'], category: 'home-living', shop: 'nile', inventory: 5 },
  { name: 'Potted Succulent in Ceramic Pot', slug: 'potted-succulent-ceramic-pot', description: 'A hardy haworthia succulent in a 12 cm mint ceramic pot. Thrives on a sunny windowsill and needs water only every two weeks.', price: 280, images: ['1485955900006-10f4d324d411'], category: 'home-living', shop: 'nile', inventory: 45 },
  { name: 'Upholstered Tufted Bed Frame, Queen', slug: 'upholstered-tufted-bed-frame', description: 'A button-tufted linen-look headboard on a sturdy slatted frame. Fits a 160 × 200 cm mattress. Delivered with assembly included.', price: 14900, images: ['1582582621959-48d27397dc69'], category: 'home-living', shop: 'nile', inventory: 3 },
];

async function main() {
  const categoryIds = new Map<string, string>();
  for (const category of categories) {
    const saved = await prisma.category.upsert({ where: { slug: category.slug }, update: category, create: category });
    categoryIds.set(saved.slug, saved.id);
  }
  for (const existing of await prisma.category.findMany({ select: { id: true, slug: true } })) categoryIds.set(existing.slug, existing.id);

  const shopIds = new Map<string, string>();
  for (const { key, ...shop } of shops) {
    const saved = await prisma.user.upsert({
      where: { email: shop.email }, update: { bio: shop.bio },
      create: { ...shop, role: Role.SELLER, passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 12) },
    });
    shopIds.set(key, saved.id);
  }

  for (const product of products) {
    const images = product.images.map((id) => photo(id));
    const data = {
      name: product.name, description: product.description, price: product.price, compareAt: product.compareAt ?? null,
      imageUrl: images[0]!, images, inventory: product.inventory, featured: product.featured ?? false, status: ProductStatus.ACTIVE,
      categoryId: categoryIds.get(product.category)!, sellerId: shopIds.get(product.shop)!, createdAt: listedAt(product.slug),
    };
    await prisma.product.upsert({ where: { slug: product.slug }, update: data, create: { ...data, slug: product.slug } });
  }
  console.log(`Catalog ready: ${categories.length} categories, ${shops.length} shops, ${products.length} products upserted.`);
}

main().finally(() => prisma.$disconnect());
