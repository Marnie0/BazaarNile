// Adds size and colour options to clothing and shoes, and demo shopper reviews across the catalog.
// Idempotent: options are only added to listings that have none, reviews are upserted per shopper and
// product. Demo reviews are never marked as verified purchases. Run with `npm run db:seed:reviews`.
import { randomBytes } from 'node:crypto';
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const hash = (value: string) => [...value].reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) >>> 0, 17);

const apparel = ['S', 'M', 'L', 'XL'];
const shoes = ['40', '41', '42', '43', '44'];
// Stock per option, in option order. A few zeros make sold-out sizes look like a real shop.
const options: Record<string, { names: string[]; values: string[][]; stock: number[] }> = {
  'soft-cotton-hoodie': { names: ['Size', 'Color'], values: [apparel, ['Black', 'Oat']], stock: [2, 4, 5, 3, 1, 3, 4, 2] },
  'graphic-cotton-tee': { names: ['Size'], values: [apparel], stock: [12, 18, 15, 10] },
  'fleece-jogger-set': { names: ['Size', 'Color'], values: [apparel, ['Charcoal', 'Navy']], stock: [2, 3, 4, 2, 0, 3, 5, 2] },
  'retro-runner-sneakers': { names: ['Size'], values: [shoes], stock: [0, 1, 1, 0, 0] },
  'tailored-oxford-shirt': { names: ['Size', 'Color'], values: [apparel, ['White', 'Sky blue']], stock: [4, 6, 5, 3, 4, 6, 6, 4] },
  'everyday-white-sneakers': { names: ['Size'], values: [shoes], stock: [4, 6, 7, 5, 2] },
  'suede-bomber-jacket': { names: ['Size'], values: [apparel], stock: [3, 5, 4, 2] },
  'linen-weekend-shirt': { names: ['Size', 'Color'], values: [apparel, ['Sand', 'Olive']], stock: [3, 4, 3, 2, 2, 4, 4, 2] },
  'essential-white-tshirts-3-pack': { names: ['Size'], values: [apparel], stock: [18, 24, 22, 16] },
  'lightweight-running-shoes': { names: ['Size'], values: [shoes], stock: [5, 6, 8, 6, 3] },
  'floral-print-stiletto-heels': { names: ['Size'], values: [['36', '37', '38', '39', '40']], stock: [1, 3, 2, 3, 0] },
};
const combinations = (values: string[][]): string[][] => values.reduce<string[][]>((rows, list) => rows.flatMap((row) => list.map((value) => [...row, value])), [[]]);

const reviewers = [
  ['mariam_h', 'Mariam H.'], ['omar_k', 'Omar K.'], ['nour_elsayed', 'Nour El-Sayed'], ['youssef_a', 'Youssef A.'],
  ['salma_r', 'Salma R.'], ['karim_m', 'Karim M.'], ['hana_f', 'Hana F.'], ['ahmed_t', 'Ahmed T.'],
  ['laila_s', 'Laila S.'], ['mostafa_g', 'Mostafa G.'], ['farida_n', 'Farida N.'], ['ziad_b', 'Ziad B.'],
] as const;

type Template = [rating: number, title: string, body: string];
const general: Template[] = [
  [5, 'Exactly as described', 'Arrived well packed and looks just like the photos. The seller answered my questions quickly before I ordered.'],
  [5, 'Great value', 'Honestly better than I expected for the price. Delivery to my area took three days and the courier called ahead.'],
  [4, 'Very happy overall', 'Good quality and it does the job. Took a little longer to arrive than I hoped, but I’d still buy it again.'],
  [5, 'Bought a second one', 'Loved it so much that I ordered another as a gift. Paying cash on delivery made it easy.'],
  [4, 'Solid choice', 'Nicely made and feels durable. Knocked off one star only because the packaging was a bit plain.'],
  [3, 'Good, not perfect', 'It’s fine for everyday use. The finish is a little different from the photos, but it works well.'],
  [5, 'Recommend this shop', 'Second order from this seller and both times everything was perfect. Well wrapped and on time.'],
  [4, 'Does what it says', 'No complaints after a few weeks of use. Would be five stars with slightly faster shipping.'],
  [2, 'Not for me', 'The quality is okay, but it wasn’t what I had in mind. The seller was polite about my questions though.'],
];
const byCategory: Record<string, Template[]> = {
  fashion: [
    [5, 'Fits true to size', 'I ordered my usual size and it fits perfectly. The fabric is soft and still looks new after several washes.'],
    [4, 'Nice cut, runs slightly small', 'Really like the style. If you’re between sizes, go one up. Colour is exactly as pictured.'],
    [5, 'My new favourite', 'Comfortable all day and I’ve had compliments every time I wear it. Great quality for the price.'],
    [3, 'Okay quality', 'Looks good, but the material is thinner than I expected. Fine for summer.'],
  ],
  electronics: [
    [5, 'Battery life is excellent', 'Easily lasts me more than a day. Setup took two minutes and it came with the local warranty card.'],
    [4, 'Great sound for the money', 'Clear, well balanced and comfortable. The companion app could be better, but the hardware is great.'],
    [5, 'Genuine and sealed', 'Box arrived sealed with the serial number matching the warranty. Works flawlessly.'],
    [3, 'Good, with a caveat', 'Works well, but the charger isn’t included in the box. Worth knowing before you order.'],
  ],
  beauty: [
    [5, 'My skin loves this', 'Absorbs quickly and isn’t greasy. I noticed a difference in a couple of weeks. Lovely natural scent.'],
    [4, 'Gentle and effective', 'Works well on my sensitive skin with no irritation. A little goes a long way.'],
    [5, 'Beautiful packaging', 'Bought it as a gift and it looked premium. My sister already asked where it’s from.'],
  ],
  'home-living': [
    [5, 'Transformed the room', 'Looks even better in person. Solid build and the colour is warm and rich.'],
    [4, 'Well made', 'Sturdy and nicely finished. Delivery for a big item was well coordinated with a call beforehand.'],
    [5, 'Worth every pound', 'Quality you can feel. It’s become the favourite spot in our living room.'],
  ],
  'kitchen-dining': [
    [5, 'Fresh and aromatic', 'You can tell it’s fresh. Great flavour, and the packaging keeps it that way.'],
    [5, 'Use it every day', 'Heats evenly and cleans up easily. Feels like it will last for years.'],
    [4, 'Lovely quality', 'Really nice. I’d love a bigger size option, but I’m very happy with it.'],
  ],
  'sports-outdoors': [
    [5, 'Tested it on the trail', 'Took it to Sinai for a weekend hike and it performed perfectly. Light, tough and well designed.'],
    [4, 'Good gear', 'Comfortable and solid. Instructions were a bit thin, but it was easy to figure out.'],
    [5, 'Great for training', 'Using it four times a week and it still looks new. Great value.'],
  ],
  'books-stationery': [
    [5, 'Writes beautifully', 'Smooth, no smudging, and the paper takes ink really well. Already ordering more.'],
    [5, 'Lovely selection', 'Great picks and arrived in perfect condition, not a single bent corner.'],
    [4, 'Nice quality', 'Good paper and binding. The cover shows fingerprints a bit, but that’s minor.'],
  ],
  'handmade-crafts': [
    [5, 'You can feel the craftsmanship', 'Every detail is lovely. It’s clearly handmade, with small variations that make it special.'],
    [5, 'Beautiful piece', 'Even nicer in person. Carefully wrapped, and it came with a handwritten note from the studio.'],
    [4, 'Unique and charming', 'Slightly different colour from the photo, as expected with handmade glazes, but I love it.'],
  ],
};

async function main() {
  // 1. Options for clothing and shoes.
  let optioned = 0;
  for (const [slug, config] of Object.entries(options)) {
    const product = await prisma.product.findUnique({ where: { slug }, select: { id: true, optionNames: true } });
    if (!product || product.optionNames.length) continue;
    const rows = combinations(config.values);
    await prisma.$transaction(async (tx) => {
      await tx.productVariant.createMany({ data: rows.map((row, position) => ({ productId: product.id, options: row, inventory: config.stock[position] ?? 0, position })) });
      await tx.product.update({ where: { id: product.id }, data: { optionNames: config.names, inventory: rows.reduce((sum, _, index) => sum + (config.stock[index] ?? 0), 0) } });
      // Cart lines saved before options existed can't be checked out; shoppers re-add with a size.
      await tx.cartItem.deleteMany({ where: { productId: product.id, variantId: null } });
    });
    optioned += 1;
  }

  // 2. Demo shopper accounts. Random passwords: they exist to author reviews, not to sign in.
  const users = [];
  for (const [username, displayName] of reviewers) {
    users.push(await prisma.user.upsert({
      where: { username }, update: {},
      create: { username, displayName, email: `${username}@shoppers.bazaarnile.test`, role: Role.CUSTOMER, passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 12) },
      select: { id: true },
    }));
  }

  // 3. Reviews: most products get 2–7, a few get none, like a real marketplace.
  const products = await prisma.product.findMany({ where: { status: 'ACTIVE', slug: { not: { startsWith: 'e2e-' } } }, select: { id: true, slug: true, createdAt: true, category: { select: { slug: true } } } });
  let written = 0;
  for (const product of products) {
    const seed = hash(product.slug);
    if (seed % 9 === 0) continue;
    const pool = [...(byCategory[product.category.slug] ?? []), ...general];
    const count = 2 + (seed % 6);
    for (let index = 0; index < count; index += 1) {
      const user = users[(seed + index * 5) % users.length]!;
      // Steps of 7 through a pool of 12–13 templates never repeat a template on the same product.
      const [rating, title, body] = pool[(seed + index * 7) % pool.length]!;
      const age = Math.min(Date.now() - product.createdAt.getTime(), 45 * 86_400_000);
      const createdAt = new Date(Date.now() - ((seed * (index + 3)) % Math.max(age, 86_400_000)));
      await prisma.review.upsert({
        where: { productId_userId: { productId: product.id, userId: user.id } }, update: {},
        create: { productId: product.id, userId: user.id, rating, title, body, verified: false, createdAt },
      });
      written += 1;
    }
  }
  await prisma.$executeRaw`
    UPDATE "Product" p SET "reviewCount" = s.count, "ratingAverage" = s.average
    FROM (SELECT "productId", COUNT(*)::int AS count, ROUND(AVG("rating")::numeric, 2) AS average FROM "Review" GROUP BY "productId") s
    WHERE p."id" = s."productId"`;
  console.log(`Options added to ${optioned} listings; ${written} reviews checked across ${products.length} products.`);
}

main().finally(() => prisma.$disconnect());
