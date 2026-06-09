export const currency = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

export const number = new Intl.NumberFormat("pt-PT", {
  maximumFractionDigits: 2,
});

export const percent = (v: number) =>
  `${new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 1 }).format(v * 100)}%`;

export const MESES_CURTOS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export const MESES_LONGOS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
