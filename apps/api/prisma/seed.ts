import { PrismaClient, ProductStatus, Role } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const categories = [
  { name: 'Electronics', slug: 'electronics', description: 'Smart technology for everyday life', imageUrl: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=900' },
  { name: 'Fashion', slug: 'fashion', description: 'Modern essentials and timeless style', imageUrl: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=900' },
  { name: 'Home & Living', slug: 'home-living', description: 'Thoughtful pieces for your space', imageUrl: 'https://images.unsplash.com/photo-1484101403633-562f891dc89a?w=900' },
  { name: 'Beauty', slug: 'beauty', description: 'Care routines that feel exceptional', imageUrl: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=900' },
];

const products = [
  ['Noise-Canceling Headphones', 'noise-canceling-headphones', 'Immersive wireless sound, all-day comfort, and 30-hour battery life.', 5499, 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1000', 'electronics'],
  ['Minimal Everyday Watch', 'minimal-everyday-watch', 'A clean stainless-steel timepiece designed for every occasion.', 2899, 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=1000', 'fashion'],
  ['Artisan Ceramic Set', 'artisan-ceramic-set', 'Hand-finished stoneware that makes everyday meals feel special.', 1799, 'https://images.unsplash.com/photo-1610701596007-11502861dcfa?w=1000', 'home-living'],
  ['Botanical Skincare Duo', 'botanical-skincare-duo', 'A gentle cleanser and moisturizer powered by botanical extracts.', 1299, 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=1000', 'beauty'],
  ['Portable Smart Speaker', 'portable-smart-speaker', 'Rich room-filling sound in a compact, water-resistant design.', 3199, 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=1000', 'electronics'],
  ['Linen Weekend Shirt', 'linen-weekend-shirt', 'Breathable premium linen with a relaxed, tailored silhouette.', 1499, 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=1000', 'fashion'],
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
  for (const [name, slug, description, price, imageUrl, categorySlug] of products) {
    await prisma.product.upsert({ where: { slug }, update: {}, create: {
      name, slug, description, price, imageUrl, images: [imageUrl], categoryId: categoryMap.get(categorySlug)!,
      sellerId: seller.id, inventory: 24, featured: true, status: ProductStatus.ACTIVE,
    }});
  }
}

main().finally(() => prisma.$disconnect());
