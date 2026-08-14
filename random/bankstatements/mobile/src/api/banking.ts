import { api } from "./client";

export interface BankAccount {
  id: number;
  name: string;
  mask: string;
  account_type: string;
  account_subtype: string;
  institution: { id: number; name: string; logo_url: string };
}

export interface Statement {
  id: number;
  account: number;
  period_start: string;
  period_end: string;
  file: string;
  synced_at: string;
}

export interface CheckImageUpload {
  id: number;
  account: number;
  file: string;
  check_date: string | null;
  note: string;
  uploaded_at: string;
}

export async function fetchLinkToken(organizationId: number): Promise<string> {
  const { data } = await api.post("/plaid/link-token/", { organization_id: organizationId });
  return data.link_token;
}

export async function exchangePublicToken(params: {
  organizationId: number;
  publicToken: string;
  institutionId: string;
  institutionName: string;
}) {
  await api.post("/plaid/exchange/", {
    organization_id: params.organizationId,
    public_token: params.publicToken,
    institution_id: params.institutionId,
    institution_name: params.institutionName,
  });
}

export async function fetchAccounts(organizationId: number): Promise<BankAccount[]> {
  const { data } = await api.get("/accounts/", { params: { organization_id: organizationId } });
  return data.results ?? data;
}

export async function fetchStatements(accountId: number): Promise<Statement[]> {
  const { data } = await api.get("/statements/", { params: { account_id: accountId } });
  return data.results ?? data;
}

export async function fetchCheckImages(accountId: number): Promise<CheckImageUpload[]> {
  const { data } = await api.get("/check-images/", { params: { account_id: accountId } });
  return data.results ?? data;
}

// Manual upload — the human has already logged into their own bank portal
// and downloaded the check image/PDF themselves; this just sends the file.
export async function uploadCheckImage(params: {
  accountId: number;
  fileUri: string;
  fileName: string;
  mimeType: string;
  checkDate?: string;
  note?: string;
}) {
  const form = new FormData();
  form.append("account", String(params.accountId));
  // React Native's FormData accepts this {uri, name, type} shape directly.
  form.append("file", {
    uri: params.fileUri,
    name: params.fileName,
    type: params.mimeType,
  } as unknown as Blob);
  if (params.checkDate) form.append("check_date", params.checkDate);
  if (params.note) form.append("note", params.note);

  await api.post("/check-images/", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}
