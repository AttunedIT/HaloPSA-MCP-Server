export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

export interface HaloListResponse<T> {
  record_count: number;
  page_size?: number;
  records: T[];
}

/**
 * Extracts the data array from a HaloPSA list API response.
 *
 * The API returns the array under an endpoint-specific key (e.g. "tickets",
 * "clients", "assets") rather than a generic "records" key. This helper finds
 * the first array value in the response object and normalises the shape into
 * a standard HaloListResponse<T>.
 */
export function extractListResponse<T>(raw: Record<string, unknown> | unknown[]): HaloListResponse<T> {
  // Some endpoints (e.g. /Status) return a bare array instead of an object.
  if (Array.isArray(raw)) {
    return { record_count: raw.length, records: raw as T[] };
  }

  const record_count = (raw.record_count as number) ?? 0;
  const page_size = raw.page_size as number | undefined;

  // Find the first value that is an array — that's the data.
  for (const value of Object.values(raw)) {
    if (Array.isArray(value)) {
      return { record_count, page_size, records: value as T[] };
    }
  }

  // Fallback: no array found — return empty records.
  return { record_count, page_size, records: [] };
}

export interface HaloTicket {
  id: number;
  summary: string;
  details: string;
  tickettype_id: number;
  client_id: number;
  client_name?: string;
  site_id?: number;
  user_id?: number;
  user_name?: string;
  agent_id?: number;
  agent_name?: string;
  team_id?: number;
  team?: string;
  status_id: number;
  status?: string;
  priority_id?: number;
  priority?: string;
  category_1?: string;
  category_2?: string;
  category_3?: string;
  sla_id?: number;
  dateoccurred?: string;
  datecreated?: string;
  deadlinedate?: string;
  reportedby?: number;
  [key: string]: unknown;
}

export interface HaloAction {
  id: number;
  ticket_id: number;
  who: string;
  who_agentid?: number;
  note: string;
  note_html?: string;
  outcome: string;
  outcome_id?: number;
  sendemail?: boolean;
  emailfrom?: string;
  emailto?: string;
  hiddenfromuser?: boolean;
  timetaken?: number;
  datetimestamp?: string;
  [key: string]: unknown;
}

export interface HaloClient {
  id: number;
  name: string;
  toplevel_id?: number;
  is_vip?: boolean;
  colour?: string;
  inactive?: boolean;
  main_site_id?: number;
  website?: string;
  phone_number?: string;
  email?: string;
  notes?: string;
  [key: string]: unknown;
}

export interface HaloAsset {
  id: number;
  inventory_number?: string;
  client_id?: number;
  client_name?: string;
  site_id?: number;
  user_id?: number;
  user_name?: string;
  assettype_id?: number;
  assettype_name?: string;
  key_field?: string;
  key_field2?: string;
  inactive?: boolean;
  [key: string]: unknown;
}

export interface HaloAgent {
  id: number;
  name: string;
  email?: string;
  team?: string;
  team_id?: number;
  is_disabled?: boolean;
  role?: string;
  [key: string]: unknown;
}

export interface HaloSite {
  id: number;
  name: string;
  client_id: number;
  client_name?: string;
  phone_number?: string;
  colour?: string;
  inactive?: boolean;
  [key: string]: unknown;
}

export interface HaloContract {
  id: number;
  ref?: string;
  client_id: number;
  client_name?: string;
  type?: string;
  startdate?: string;
  enddate?: string;
  billing_cycle?: string;
  [key: string]: unknown;
}

export interface HaloProject {
  id: number;
  summary: string;
  client_id?: number;
  client_name?: string;
  status?: string;
  dateoccurred?: string;
  deadlinedate?: string;
  [key: string]: unknown;
}

export interface HaloInvoice {
  id: number;
  client_id: number;
  client_name?: string;
  invoicenumber?: string;
  datedue?: string;
  total?: number;
  tax?: number;
  status?: string;
  [key: string]: unknown;
}

export interface HaloAppointment {
  id: number;
  subject?: string;
  start_date?: string;
  end_date?: string;
  agent_id?: number;
  ticket_id?: number;
  client_id?: number;
  is_task?: boolean;
  complete_status?: number;
  [key: string]: unknown;
}

export interface HaloKBArticle {
  id: number;
  name?: string;
  type?: number;
  inactive?: boolean;
  [key: string]: unknown;
}

export interface HaloSupplier {
  id: number;
  name: string;
  phone_number?: string;
  email?: string;
  website?: string;
  [key: string]: unknown;
}

export interface HaloQuotation {
  id: number;
  client_id?: number;
  client_name?: string;
  status?: string;
  [key: string]: unknown;
}

export interface HaloOpportunity {
  id: number;
  summary?: string;
  client_id?: number;
  client_name?: string;
  value?: number;
  [key: string]: unknown;
}

export interface HaloTeam {
  id: number;
  name: string;
  [key: string]: unknown;
}

export interface HaloStatus {
  id: number;
  name: string;
  [key: string]: unknown;
}

export interface HaloItem {
  id: number;
  name: string;
  baseprice?: number;
  costprice?: number;
  taxcode?: number;
  nominalcode?: string;
  assetgroup_name?: string;
  supplier_name?: string;
  [key: string]: unknown;
}

export interface HaloRecurringInvoice {
  id: number;
  client_id?: number;
  client_name?: string;
  total?: number;
  contract_id?: number;
  contract_ref?: string;
  [key: string]: unknown;
}

export interface HaloCategory {
  id: number;
  value: string;
  category_name?: string;
  type_id?: number;
  sla_id?: number;
  priority_id?: number;
  [key: string]: unknown;
}

export interface HaloService {
  id: number;
  name: string;
  summary?: string;
  service_category_id?: number;
  service_category_name?: string;
  trackstatus?: boolean;
  subscriber_count?: number;
  cost?: number;
  [key: string]: unknown;
}

export interface HaloUser {
  id: number;
  name: string;
  firstname?: string;
  surname?: string;
  emailaddress?: string;
  phonenumber?: string;
  site_id?: number;
  site_name?: string;
  client_id?: number;
  client_name?: string;
  inactive?: boolean;
  [key: string]: unknown;
}
