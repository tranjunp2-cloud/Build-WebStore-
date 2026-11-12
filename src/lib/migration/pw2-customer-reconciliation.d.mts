import type { Row, StoreOutput } from './pw1-export/contracts'
export function normalizeCustomerPhone(value: string | null | undefined): string | null
export function reconcileCustomers(store:StoreOutput,storeId:string,tables:Readonly<Record<string,Row[]>>,options:{utcOffset:string}):{store:StoreOutput;diagnostics:{customerCrosswalk:{sourceCustomerId:string;targetRef:string|null;disposition:string}[];addressDispositions:{sourceAddressId:string;targetRef:string;targetIndex?:number|null;disposition:string}[];rankDispositions:{sourceCustomerId:string;disposition:string}[]};archive:unknown}
