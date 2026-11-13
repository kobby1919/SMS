export type ClientCAEntryWindow = {
  allowed: boolean;
  label: string;
  reason: string | null;
  closesAt?: string;
};

export function currentCAEntryWindow<T extends ClientCAEntryWindow>(status: T, now = Date.now()): T {
  if (!status.allowed || !status.closesAt || now <= Date.parse(status.closesAt)) return status;
  return {
    ...status,
    allowed: false,
    reason: "This CA entry window has closed. Your unsaved marks remain on this page. Refresh to check the next available lesson window; saved scores require the correction workflow.",
  };
}
