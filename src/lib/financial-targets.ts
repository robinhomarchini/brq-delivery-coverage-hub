export const targetMarginPercent = 36.8;

export function formatPercentPtBr(value: number) {
  return `${value.toFixed(1).replace(".", ",")}%`;
}
