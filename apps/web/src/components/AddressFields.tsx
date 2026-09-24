import { addressNames, governorates, type AddressFieldNames } from '../lib/address';
import type { Address } from '../lib/api';
import { Field, Input, Textarea } from './ui/Field';
import { t } from '../lib/i18n';

/** Delivery address inputs shared by checkout and saved addresses. Lay them out in a two-column grid. */
export function AddressFields({ names = addressNames, initial, idPrefix = 'address' }: { names?: AddressFieldNames; initial?: Partial<Address>; idPrefix?: string }) {
  const listId = `${idPrefix}-governorates`;
  return <>
    <Field label={t('Full name')}><Input name={names.fullName} defaultValue={initial?.fullName} autoComplete="name" required minLength={2} maxLength={80}/></Field>
    <Field label={t('Phone number')} hint={t('The courier will call this number on delivery.')}><Input name={names.phone} defaultValue={initial?.phone} type="tel" inputMode="tel" autoComplete="tel" required minLength={8} maxLength={20} pattern="[\d\s+\-\(\)]{8,20}" title={t('8–20 digits; spaces, +, - and brackets are allowed')} placeholder="01X XXXX XXXX"/></Field>
    <Field label={t('Street address')} className="sm:col-span-2"><Input name={names.street} defaultValue={initial?.street} autoComplete="street-address" required minLength={3} maxLength={200} placeholder={t('Building, street, floor, apartment')}/></Field>
    <Field label={t('City / district')}><Input name={names.city} defaultValue={initial?.city} autoComplete="address-level2" required minLength={2} maxLength={80}/></Field>
    <Field label={t('Governorate')}><Input name={names.region} defaultValue={initial?.region} list={listId} autoComplete="address-level1" required minLength={2} maxLength={80}/><datalist id={listId}>{governorates.map((name) => <option key={name} value={name}/>)}</datalist></Field>
    <Field label={t('Delivery notes')} hint={t('Optional — landmarks, best time to call')} className="sm:col-span-2"><Textarea className="min-h-20" name={names.notes} defaultValue={initial?.notes ?? ''} maxLength={500}/></Field>
  </>;
}
