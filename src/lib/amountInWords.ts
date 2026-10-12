// Indian-system amount in words (lakh/crore), for the printed invoice total.

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? " " + ONES[n % 10] : ""}`;
}

export function amountInWords(amount: number): string {
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  if (rupees === 0 && paise === 0) return "Zero Rupees Only";

  const groups: string[] = [];
  const crore = Math.floor(rupees / 10000000);
  const lakh = Math.floor((rupees % 10000000) / 100000);
  const thousand = Math.floor((rupees % 100000) / 1000);
  const hundred = Math.floor((rupees % 1000) / 100);
  const rest = rupees % 100;

  if (crore) groups.push(`${twoDigits(crore)} Crore`);
  if (lakh) groups.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) groups.push(`${twoDigits(thousand)} Thousand`);
  if (hundred) groups.push(`${ONES[hundred]} Hundred`);
  if (rest) groups.push(twoDigits(rest));

  return `${groups.join(" ")} Rupees${paise ? ` and ${twoDigits(paise)} Paise` : ""} Only`;
}