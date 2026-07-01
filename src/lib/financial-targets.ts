export const targetMarginPercent = 35.8;

export function formatPercentPtBr(value: number) {
  return `${value.toFixed(1).replace(".", ",")}%`;
}
