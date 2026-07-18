import { writable, derived, get } from 'svelte/store';
import { SystemBridge } from '../../../utils/systemBridge';

export interface MailAccount {
  id: string; name: string; email: string;
  imapHost: string; imapPort: number;
  smtpHost: string; smtpPort: number;
  username: string; password: string;
  useSsl: boolean;
}

function toRust(a: MailAccount) {
  return { ...a, imap_host: a.imapHost, imap_port: a.imapPort, smtp_host: a.smtpHost, smtp_port: a.smtpPort, use_ssl: a.useSsl };
}
function fromRust(r: any): MailAccount {
  return { id: r.id, name: r.name, email: r.email, imapHost: r.imap_host, imapPort: r.imap_port, smtpHost: r.smtp_host, smtpPort: r.smtp_port, username: r.username, password: '', useSsl: r.use_ssl };
}

export function createAccounts() {
  const accounts = writable<MailAccount[]>([]);
  const activeAcct = writable<string | null>(null);
  const loading = writable(false);

  if (SystemBridge.isTauri()) {
    SystemBridge.invokeCommand<any[]>('mail_get_accounts').then((list) => {
      if (list?.length) { accounts.set(list.map(fromRust)); activeAcct.set(list[0].id); }
    }).catch(() => {});
  }

  const activeAccount = derived([accounts, activeAcct], ([$accounts, $activeAcct]) => $accounts.find((a) => a.id === $activeAcct) ?? null);

  async function saveAccount(acct: MailAccount) {
    if (SystemBridge.isTauri()) await SystemBridge.invokeCommand('mail_save_account', { account: toRust(acct) });
    accounts.update((prev) => [...prev.filter((a) => a.id !== acct.id), acct]);
    activeAcct.set(acct.id);
  }

  async function deleteAccount(id: string) {
    if (SystemBridge.isTauri()) await SystemBridge.invokeCommand('mail_delete_account', { accountId: id });
    accounts.update((prev) => prev.filter((a) => a.id !== id));
    if (get(activeAcct) === id) activeAcct.set(null);
  }

  return { accounts, activeAcct, activeAccount, loading, saveAccount, deleteAccount };
}
