// Agent-name anonymization · single source of truth (mirrors the offline
// builder's archetype map). Client-facing surfaces never show raw agent or
// org names; they show use-case archetypes.
const ARCHETYPE: Record<string, string> = {
  "Visi Cooler Support v5.1 | Prod": "Field Support · Appliances",
  "Unicommerce": "Order Confirmation · E-commerce",
  "GoKwik 2": "Cart Recovery · E-commerce A",
  "BiteSpeed": "Cart Recovery · E-commerce B",
  "Alibaba India": "Seller Activation · B2B Marketplace",
  "[Prod] Abandoned Cart": "Cart Recovery · D2C Brand A",
  "Referral-Hindi": "Referral Outreach · Hindi",
  "NCR v6 - onboarding": "Hiring & Onboarding",
  "NCR Hiring (without SC) v5": "Hiring & Onboarding B",
  "Pronto Delhi NCR Hiring": "Hiring · Delhi NCR",
  "Indian Online Version": "Lead Qualification · EdTech",
  "Online MBA_Skillup": "Lead Qualification · EdTech B",
  "[giva-jewelry.myshopify.com] abandoned-checkout": "Cart Recovery · D2C Jewelry",
  "pocketly-bkt0-due-reminder-priya-vobiz": "Payment Reminder · Fintech",
  "flot-bullet-loan-reminder-ziina-vobiz": "Loan Reminder · Fintech",
  "slice-bkt0-gentle-ziina": "Payment Reminder · Fintech B",
  "[thedermaco.myshopify.com] abandoned-checkout": "Cart Recovery · D2C Skincare",
  "Zara - [Prod] Abandon Cart": "Cart Recovery · D2C Fashion",
  "Diallo Collections Demo Bani Production": "Collections · D2C",
  "Stage Inbound General - Bani Production": "Inbound Support · General"
};

export function anonAgent(name: unknown): string {
  const n = String(name || "").trim();
  if (ARCHETYPE[n]) return ARCHETYPE[n];
  const low = n.toLowerCase();
  if (!n || n === "unattributed" || /^\d+$/.test(n)) return "Voice Agent";
  if (low.includes("hiring") || low.includes("onboard") || low.includes("registration")) return "Hiring & Onboarding";
  if (low.includes("abandon") || low.includes("cart") || low.includes("checkout")) return "Cart Recovery · E-commerce";
  if (low.includes("reminder") || low.includes("loan") || low.includes("emi") || low.includes("payment") || low.includes("due")) return "Payment Reminder · Fintech";
  if (low.includes("lead") || low.includes("qualif") || low.includes("mba") || low.includes("btech") || low.includes("university") || low.includes("college")) return "Lead Qualification";
  if (low.includes("support") || low.includes("inbound") || low.includes("cooler")) return "Field Support";
  if (low.includes("referral")) return "Referral Outreach";
  return "Voice Agent";
}
