import type { Variant } from './api';
import { t } from './i18n';

export type Selection = (string | null)[];

/** The variant matching every chosen value, or undefined while a choice is missing. */
export const matchVariant = (variants: Variant[], selection: Selection) =>
  selection.every(Boolean) ? variants.find((variant) => variant.options.every((value, index) => value === selection[index])) : undefined;

/** Pre-selects any option that only has one value, such as a single colour. */
export const initialSelection = (optionNames: string[], variants: Variant[]): Selection =>
  optionNames.map((_, index) => { const values = [...new Set(variants.map((variant) => variant.options[index]!))]; return values.length === 1 ? values[0]! : null; });

/** Order lines store "Size: M · Color: Black" in English; translate the option names for display. */
export const variantLabelText = (label: string) => label.split(' · ').map((part) => {
  const [name, ...value] = part.split(': ');
  return value.length ? `${t(name!)}: ${value.join(': ')}` : part;
}).join(' · ');
