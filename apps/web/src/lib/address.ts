export const governorates = ['Alexandria', 'Aswan', 'Asyut', 'Beheira', 'Beni Suef', 'Cairo', 'Dakahlia', 'Damietta', 'Faiyum', 'Gharbia', 'Giza', 'Ismailia', 'Kafr El Sheikh', 'Luxor', 'Matrouh', 'Minya', 'Monufia', 'New Valley', 'North Sinai', 'Port Said', 'Qalyubia', 'Qena', 'Red Sea', 'Sharqia', 'Sohag', 'South Sinai', 'Suez'];

export type AddressFieldNames = { fullName: string; phone: string; street: string; city: string; region: string; notes: string };
export const checkoutNames: AddressFieldNames = { fullName: 'shippingName', phone: 'shippingPhone', street: 'shippingAddress', city: 'shippingCity', region: 'shippingRegion', notes: 'notes' };
export const addressNames: AddressFieldNames = { fullName: 'fullName', phone: 'phone', street: 'street', city: 'city', region: 'region', notes: 'notes' };
