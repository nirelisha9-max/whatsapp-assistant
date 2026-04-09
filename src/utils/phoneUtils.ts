export function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");

  if (digits.startsWith("972")) {
    // already correct
  } else if (digits.startsWith("0")) {
    digits = "972" + digits.substring(1);
  } else if (digits.length === 9) {
    digits = "972" + digits;
  }

  return digits;
}

export function formatChatId(id: string, isGroup: boolean): string {
  if (isGroup) {
    return id.includes("@g.us") ? id : `${id}@g.us`;
  }
  const cleanNumber = normalizePhone(id);
  return `${cleanNumber}@c.us`;
}

export function phoneFromChatId(chatId: string): string {
  return chatId.replace(/@c\.us$/, "").replace(/@g\.us$/, "");
}
