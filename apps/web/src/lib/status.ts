import type { BadgeTone } from '../components/ui/Badge';
import type { OrderStatus, ProductStatus } from './api';
import { t } from './i18n';

// Labels are getters so they are translated when read, in whichever language is active.

export const orderStatus: Record<OrderStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { get label() { return t('Placed'); }, tone: 'warning' }, CONFIRMED: { get label() { return t('Confirmed'); }, tone: 'info' }, PROCESSING: { get label() { return t('Processing'); }, tone: 'violet' },
  SHIPPED: { get label() { return t('On the way'); }, tone: 'cyan' }, DELIVERED: { get label() { return t('Delivered'); }, tone: 'success' }, CANCELLED: { get label() { return t('Cancelled'); }, tone: 'danger' },
};

export const productStatus: Record<ProductStatus, { label: string; tone: BadgeTone; help: string }> = {
  ACTIVE: { get label() { return t('Live'); }, tone: 'success', get help() { return t('Visible in the shop'); } },
  PENDING: { get label() { return t('In review'); }, tone: 'info', get help() { return t('Waiting for admin approval'); } },
  REJECTED: { get label() { return t('Rejected'); }, tone: 'danger', get help() { return t('Edit and resubmit for review'); } },
  DRAFT: { get label() { return t('Draft'); }, tone: 'warning', get help() { return t('Only visible to you'); } },
  ARCHIVED: { get label() { return t('Archived'); }, tone: 'neutral', get help() { return t('No longer for sale'); } },
};
