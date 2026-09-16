import { CouponType, PrismaClient, ProductStatus, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const categories = [
  { name: 'Electronics', slug: 'electronics', description: 'Smart technology for everyday life', imageUrl: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=900' },
  { name: 'Fashion', slug: 'fashion', description: 'Modern essentials and timeless style', imageUrl: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=900' },
  { name: 'Home & Living', slug: 'home-living', description: 'Thoughtful pieces for your space', imageUrl: 'https://images.unsplash.com/photo-1484101403633-562f891dc89a?w=900' },
  { name: 'Beauty', slug: 'beauty', description: 'Care routines that feel exceptional', imageUrl: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=900' },
];

const products = [
  ['Noise-Canceling Headphones', 'noise-canceling-headphones', 'Immersive wireless sound, all-day comfort, and 30-hour battery life.', 5499, 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1000', 'electronics', true],
  ['Minimal Everyday Watch', 'minimal-everyday-watch', 'A clean stainless-steel timepiece designed for every occasion.', 2899, 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=1000', 'fashion', true],
  ['Artisan Ceramic Set', 'artisan-ceramic-set', 'Hand-finished stoneware that makes everyday meals feel special.', 1799, 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=1000', 'home-living', true],
  ['Botanical Skincare Duo', 'botanical-skincare-duo', 'A gentle cleanser and moisturizer powered by botanical extracts.', 1299, 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=1000', 'beauty', true],
  ['Portable Smart Speaker', 'portable-smart-speaker', 'Rich room-filling sound in a compact, water-resistant design.', 3199, 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=1000', 'electronics', true],
  ['Linen Weekend Shirt', 'linen-weekend-shirt', 'Breathable premium linen with a relaxed, tailored silhouette.', 1499, 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=1000', 'fashion', true],
  ['Wireless Mechanical Keyboard', 'wireless-mechanical-keyboard', 'Tactile low-profile switches, multi-device pairing, and a compact aluminum frame.', 2399, 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=1000', 'electronics', true],
  ['Compact Mirrorless Camera', 'compact-mirrorless-camera', 'A travel-ready camera with crisp 4K video, fast autofocus, and interchangeable lenses.', 18999, 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=1000', 'electronics', false],
  ['Smart Fitness Watch', 'smart-fitness-watch', 'Track workouts, sleep, heart rate, and notifications with a bright all-day display.', 3499, 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1000', 'electronics', true],
  ['Fast-Charging USB-C Charger', 'fast-charging-usb-c-charger', 'A compact dual-port wall charger with fast USB-C power delivery for everyday devices.', 1199, 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=1000', 'electronics', false],
  ['Classic Leather Backpack', 'classic-leather-backpack', 'A structured everyday backpack with a padded laptop sleeve and durable metal hardware.', 2699, 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=1000', 'fashion', true],
  ['Everyday White Sneakers', 'everyday-white-sneakers', 'Clean, versatile sneakers with cushioned insoles and a lightweight rubber sole.', 2299, 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1000', 'fashion', true],
  ['Polarized Sunglasses', 'polarized-sunglasses', 'Lightweight frames with polarized UV400 lenses for clear, comfortable vision.', 1399, 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=1000', 'fashion', false],
  ['Soft Cotton Hoodie', 'soft-cotton-hoodie', 'A relaxed midweight hoodie made from soft brushed cotton for cooler evenings.', 1899, 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=1000', 'fashion', false],
  ['Sculptural Table Lamp', 'sculptural-table-lamp', 'Warm ambient lighting with a modern silhouette that complements desks and bedside tables.', 2199, 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=1000', 'home-living', true],
  ['Linen Cushion Pair', 'linen-cushion-pair', 'Two textured linen-blend cushions filled for soft, supportive everyday comfort.', 1099, 'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?w=1000', 'home-living', false],
  ['Acacia Serving Board', 'acacia-serving-board', 'A naturally grained acacia board for serving bread, fruit, and shared appetizers.', 899, 'https://images.unsplash.com/photo-1610701596061-2ecf227e85b2?w=1000', 'home-living', false],
  ['Woven Storage Basket', 'woven-storage-basket', 'A sturdy handwoven basket that keeps blankets, toys, and everyday essentials organized.', 749, 'https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=1000', 'home-living', true],
  ['Vitamin C Face Serum', 'vitamin-c-face-serum', 'A lightweight brightening serum with vitamin C and hydrating hyaluronic acid.', 899, 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=1000', 'beauty', true],
  ['Signature Eau de Parfum', 'signature-eau-de-parfum', 'A modern fragrance blending warm amber, soft florals, and fresh citrus notes.', 1699, 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=1000', 'beauty', true],
  ['Velvet Matte Lip Set', 'velvet-matte-lip-set', 'Three richly pigmented everyday shades with a smooth, comfortable matte finish.', 699, 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?w=1000', 'beauty', false],
  ['Rose Quartz Facial Roller', 'rose-quartz-facial-roller', 'A naturally cool stone roller designed for a calming facial massage routine.', 549, 'https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?w=1000', 'beauty', false],
] as const;

async function main() {
  const seller = await prisma.user.upsert({
    where: { email: 'seller@bazaarnile.com' }, update: {},
    create: { email: 'seller@bazaarnile.com', username: 'nile_select', displayName: 'Nile Select',
      bio: 'Curated essentials from trusted makers.', passwordHash: await bcrypt.hash('BazaarNile123!', 12), role: Role.SELLER },
  });
  const categoryMap = new Map<string, string>();
  for (const category of categories) {
    const saved = await prisma.category.upsert({ where: { slug: category.slug }, update: category, create: category });
    categoryMap.set(saved.slug, saved.id);
  }
  for (const [name, slug, description, price, imageUrl, categorySlug, featured] of products) {
    await prisma.product.upsert({ where: { slug }, update: {}, create: {
      name, slug, description, price, imageUrl, images: [imageUrl], categoryId: categoryMap.get(categorySlug)!,
      sellerId: seller.id, inventory: 24, featured, status: ProductStatus.ACTIVE,
    }});
  }
  await prisma.coupon.upsert({ where: { code: 'WELCOME10' }, update: {}, create: {
    code: 'WELCOME10', type: CouponType.PERCENTAGE, value: 10, minOrderAmount: 500, maxDiscount: 500,
  } });
}

main().finally(() => prisma.$disconnect());
