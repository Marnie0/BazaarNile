import type { BadgeTone } from '../components/ui/Badge';
import type { OrderStatus, ProductStatus } from './api';

export const orderStatus: Record<OrderStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: 'Placed', tone: 'warning' }, CONFIRMED: { label: 'Confirmed', tone: 'info' }, PROCESSING: { label: 'Processing', tone: 'violet' },
  SHIPPED: { label: 'On the way', tone: 'cyan' }, DELIVERED: { label: 'Delivered', tone: 'success' }, CANCELLED: { label: 'Cancelled', tone: 'danger' },
};

export const productStatus: Record<ProductStatus, { label: string; tone: BadgeTone; help: string }> = {
  ACTIVE: { label: 'Live', tone: 'success', help: 'Visible in the shop' },
  PENDING: { label: 'In review', tone: 'info', help: 'Waiting for admin approval' },
  REJECTED: { label: 'Rejected', tone: 'danger', help: 'Edit and resubmit for review' },
  DRAFT: { label: 'Draft', tone: 'warning', help: 'Only visible to you' },
  ARCHIVED: { label: 'Archived', tone: 'neutral', help: 'No longer for sale' },
};
