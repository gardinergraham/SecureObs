export function calculateAge(dateOfBirth?: string, today = new Date()) {
  if (!dateOfBirth) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth);
  if (!match) return undefined;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const birthDate = new Date(Date.UTC(year, month - 1, day));
  if (
    birthDate.getUTCFullYear() !== year ||
    birthDate.getUTCMonth() !== month - 1 ||
    birthDate.getUTCDate() !== day ||
    birthDate.getTime() > today.getTime()
  ) {
    return undefined;
  }

  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age -= 1;
  return age;
}

export function formatDateOfBirth(dateOfBirth?: string) {
  if (!dateOfBirth) return "Not recorded";
  const [year, month, day] = dateOfBirth.split("-");
  return year && month && day ? `${day}/${month}/${year}` : dateOfBirth;
}
