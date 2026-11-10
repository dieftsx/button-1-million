const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export const formatBRL = (v: number) => brl.format(v);
export const formatInt = (v: number) => v.toLocaleString("pt-BR");

export function timeAgo(date: Date, now: number): string {
  const s = Math.max(0, Math.floor((now - date.getTime()) / 1000));
  if (s < 45) return "agora";
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${Math.max(1, m)} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  return `há ${Math.floor(h / 24)} d`;
}
