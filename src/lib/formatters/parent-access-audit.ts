import type { ParentAccessAuditAction } from "@/src/generated/prisma";

export function parentAccessAuditLabel(action: ParentAccessAuditAction | string) {
  switch (action) {
    case "PARENT_INVITED":
      return "Parent invited";
    case "PARENT_ACCOUNT_ACTIVATED":
      return "Account activated";
    case "CHILD_LINKED":
      return "Ward linked";
    case "CHILD_REMOVED":
      return "Ward removed";
    case "ACCESS_REVOKED":
      return "Access revoked";
    case "ACCESS_RESTORED":
      return "Access restored";
    case "CHILD_TRANSFERRED":
      return "Ward transferred";
    case "CHILD_GRADUATED":
      return "Ward graduated";
    case "EMAIL_CHANGED":
      return "Email changed";
    default:
      return action;
  }
}
