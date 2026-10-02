/** Tipos del lado del cliente para el constructor de automatizaciones. */

export interface CatalogOption {
  value: string;
  label: string;
}

export interface CatalogFilterField {
  key: string;
  label: string;
  options: CatalogOption[];
}

export interface CatalogTrigger {
  key: string;
  label: string;
  description: string;
  placeholders: string[];
  filterFields: CatalogFilterField[];
}

export interface CatalogActionParam {
  key: string;
  label: string;
  type: "select" | "text" | "textarea";
  required: boolean;
  placeholder: string | null;
  templated: boolean;
  options: CatalogOption[] | null;
}

export interface CatalogAction {
  key: string;
  label: string;
  description: string;
  params: CatalogActionParam[];
}

export interface Catalog {
  triggers: CatalogTrigger[];
  actions: CatalogAction[];
}

export interface RuleFilter {
  field: string;
  op: "eq" | "neq";
  value: string;
}

export interface RuleAction {
  type: string;
  params: Record<string, string>;
}

export interface RuleDraft {
  name: string;
  trigger: string;
  filters: RuleFilter[];
  actions: RuleAction[];
  enabled: boolean;
}

export interface RuleRecord extends RuleDraft {
  key: string;
  description: string | null;
  source: "seed" | "user";
}

export interface RuleListItem extends RuleRecord {
  triggerLabel: string;
  summary: { when: string; then: string };
  stats: { done: number; skipped: number; failed: number; pending: number };
}

export interface RunItem {
  id: string;
  automationKey: string;
  automationName: string;
  contactId: string | null;
  contactName: string | null;
  status: string;
  result: Array<{ type: string; status: string; detail: string }> | null;
  error: string | null;
  createdAt: string;
}

export const ACTION_ICON_KEYS: Record<string, string> = {
  push: "bell",
  add_tag: "tag",
  remove_tag: "tag-off",
  assign_owner: "user",
  create_activity: "file",
};
