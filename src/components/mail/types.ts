export interface MailAddress { name: string; address: string }

export interface MailboxInfo {
  address: string;
  name: string;
  kind: 'own' | 'shared' | 'user';
  canRead: boolean;
  canSend: boolean;
  via: string;
}

export interface MailSummary {
  id: string;
  mailbox: string;
  conversationId: string;
  subject: string;
  from: MailAddress;
  to: MailAddress[];
  receivedAt: string;
  preview: string;
  isRead: boolean;
  flagged: boolean;
  hasAttachments: boolean;
  importance: string;
  isDraft: boolean;
  folderId: string;
  categories: string[];
}

export interface MailAttachmentInfo { id: string; name: string; contentType: string; size: number; isInline: boolean; contentId: string }

export interface MailDetail extends MailSummary {
  cc: MailAddress[];
  bcc: MailAddress[];
  replyTo: MailAddress[];
  sentAt: string;
  bodyHtml: string;
  bodyIsHtml: boolean;
  internetMessageId: string;
  webLink: string;
  attachments: MailAttachmentInfo[];
}

export interface MailFolder { id: string; name: string; key: string; unread: number; total: number; childCount: number; parentId: string }

export type AssistMode = 'korrektur' | 'optimieren' | 'kuerzer' | 'freundlicher' | 'englisch';

export interface PersonalPrefs {
  signatures: Record<string, string>;
  assist_mode: AssistMode;
  default_from: string;
  title: string;
  title_en: string;
  phone: string;
  load_images: boolean;
}

export interface GlobalMailConfig {
  send_with_full_access: boolean;
  extra_access: Record<string, Array<{ mailbox: string; send: boolean }>>;
  hidden: string[];
  signature_template: string;
  mailbox_signatures: Record<string, string>;
}

export interface AccountsResponse {
  user: { email: string; name: string; firstName: string; isAdmin: boolean; employeeId: string | null };
  mailboxes: MailboxInfo[];
  warning: string | null;
  signatures: { de: Record<string, string>; en: Record<string, string> };
  prefs: PersonalPrefs;
  employees: Array<{ id: string; name: string; email: string }>;
  aiReady: boolean;
  admin: { global: GlobalMailConfig; tenantMailboxes: Array<{ address: string; name: string; type: string }> } | null;
}

export interface ContextCustomer { id: string; name: string; company: string; phone: string; city: string; emails: string[]; bookings: number; booked: number; revenue: number; url: string }
export interface ContextRequest { id: string; request_number: string; booking_number: string; title: string; status: string; start_date: string; persons: number; total: number; email: string; created_at: string; url: string; reason: string }
export interface ContextTask { id: string; ticket: string; title: string; status: string; priority: string; due_date: string | null; url: string; reason: string }
export interface MailContext {
  customers: ContextCustomer[];
  requests: ContextRequest[];
  tasks: ContextTask[];
  related: MailSummary[];
  refs: string[];
  links: Array<{ id: string; target_type: string; target_id: string; target_label: string; created_by: string; created_at: string }>;
}

export interface MailExtraction {
  typ: string;
  zusammenfassung: string;
  dringlichkeit: 'hoch' | 'normal' | 'niedrig';
  stimmung: 'positiv' | 'neutral' | 'kritisch';
  kunde: { anrede: string; vorname: string; nachname: string; firma: string; email: string; telefon: string; adresse: string };
  reise: { event: string; ort: string; von: string; bis: string; personen: number; zimmer: string; budget: string; wuensche: string[] };
  aufgaben: Array<{ titel: string; beschreibung: string; faellig: string; prioritaet: 'hoch' | 'normal' | 'niedrig' }>;
  fakten: Array<{ label: string; wert: string }>;
  vorgeschlagene_antwort: string;
}

export interface MailTemplate {
  id: string;
  kind: 'vorlage' | 'baustein';
  title: string;
  category: string;
  lang: string;
  subject: string;
  body: string;
  description: string;
  shortcut: string;
  greeting: string;
  owner: string;
  uses: number;
  created_by: string;
}

/** Ansicht in der Liste */
export interface ViewSel {
  mb: string; // Adresse oder 'all'
  folder: string; // Ordner-ID oder well-known Name
  folderName: string;
}

export interface ComposeSeed {
  key: string;
  mode: 'new' | 'reply' | 'replyAll' | 'forward';
  from: string;
  to: MailAddress[];
  cc: MailAddress[];
  subject: string;
  /** Start-Text (HTML) im Editor */
  html: string;
  reference?: { mb: string; id: string; mode: 'reply' | 'replyAll' | 'forward' };
  /** Kurzfassung der Originalmail (für KI-Kontext und Anzeige) */
  quoted?: { from: string; date: string; preview: string };
  /** Werte für Platzhalter in Vorlagen */
  vars: Record<string, string>;
  /** Start-Grussformel (Standard «Freundliche Grüsse») */
  greeting?: string;
}
