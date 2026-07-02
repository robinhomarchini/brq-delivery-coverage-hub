export interface BoardTargetBaselineRow {
  year: number;
  customerName: string;
  businessUnit: string;
  hunterTarget: number;
  farmerRenewalTarget: number;
  totalTarget: number;
}

export const boardTargetBaselineSource = {
  fileName: "metageralinicial.xlsx",
  year: 2026,
  customerColumn: "A",
  hunterColumn: "I",
  farmerRenewalColumn: "L",
  totalColumn: "M",
};

export const boardTargetBaselineRows: BoardTargetBaselineRow[] = [
  { year: 2026, customerName: "AGIBANK", businessUnit: "BU Financial", hunterTarget: 100000, farmerRenewalTarget: 0, totalTarget: 100000 },
  { year: 2026, customerName: "ALELO", businessUnit: "BU Financial", hunterTarget: 11033497.05, farmerRenewalTarget: 3177599.27, totalTarget: 14211096.32 },
  { year: 2026, customerName: "ASA INVESTMENTS", businessUnit: "BU Financial", hunterTarget: 200000, farmerRenewalTarget: 0, totalTarget: 200000 },
  { year: 2026, customerName: "ASSOCIAÇÃO OPEN FINANCE", businessUnit: "BU Financial", hunterTarget: 928275.84, farmerRenewalTarget: 1051917.96, totalTarget: 1980193.81 },
  { year: 2026, customerName: "B3", businessUnit: "BU Financial", hunterTarget: 6675497.66, farmerRenewalTarget: 26895615.02, totalTarget: 33571112.68 },
  { year: 2026, customerName: "B3 IP", businessUnit: "BU Financial", hunterTarget: 0, farmerRenewalTarget: 956863.61, totalTarget: 956863.61 },
  { year: 2026, customerName: "BANCO ABC", businessUnit: "BU Financial", hunterTarget: 0, farmerRenewalTarget: 935000, totalTarget: 935000 },
  { year: 2026, customerName: "BANCO B3", businessUnit: "BU Financial", hunterTarget: 1200000, farmerRenewalTarget: 1190613.04, totalTarget: 2390613.04 },
  { year: 2026, customerName: "BANCO BOCOM", businessUnit: "BU Financial", hunterTarget: 0, farmerRenewalTarget: 878571.05, totalTarget: 878571.05 },
  { year: 2026, customerName: "BANCO BS2", businessUnit: "BU Financial", hunterTarget: 270000, farmerRenewalTarget: 0, totalTarget: 270000 },
  { year: 2026, customerName: "BANCO ITAÚ S.A.", businessUnit: "BU Financial", hunterTarget: 44089655.33, farmerRenewalTarget: 192344140.65, totalTarget: 236433795.98 },
  { year: 2026, customerName: "BANCO PACTUAL", businessUnit: "BU Financial", hunterTarget: 1974000, farmerRenewalTarget: 27951499.89, totalTarget: 29925499.89 },
  { year: 2026, customerName: "BANCO RCI", businessUnit: "BU Financial", hunterTarget: 150000, farmerRenewalTarget: 0, totalTarget: 150000 },
  { year: 2026, customerName: "BBTS", businessUnit: "BU Financial", hunterTarget: 400000, farmerRenewalTarget: 0, totalTarget: 400000 },
  { year: 2026, customerName: "BRADESCO", businessUnit: "BU Financial", hunterTarget: 1000000, farmerRenewalTarget: 0, totalTarget: 1000000 },
  { year: 2026, customerName: "BULLLA", businessUnit: "BU Financial", hunterTarget: 360000, farmerRenewalTarget: 0, totalTarget: 360000 },
  { year: 2026, customerName: "CIP", businessUnit: "BU Financial", hunterTarget: 5668109.65, farmerRenewalTarget: 6767517.22, totalTarget: 12435626.88 },
  { year: 2026, customerName: "CREDIT SUISSE", businessUnit: "BU Financial", hunterTarget: 0, farmerRenewalTarget: 12025205.71, totalTarget: 12025205.71 },
  { year: 2026, customerName: "CRT4", businessUnit: "BU Financial", hunterTarget: 490066.67, farmerRenewalTarget: 3277435.46, totalTarget: 3767502.13 },
  { year: 2026, customerName: "CSF", businessUnit: "BU Financial", hunterTarget: 2347633.95, farmerRenewalTarget: 251163.82, totalTarget: 2598797.77 },
  { year: 2026, customerName: "CSU", businessUnit: "BU Financial", hunterTarget: 400000, farmerRenewalTarget: 0, totalTarget: 400000 },
  { year: 2026, customerName: "EDENRED", businessUnit: "BU Financial", hunterTarget: 425000, farmerRenewalTarget: 0, totalTarget: 425000 },
  { year: 2026, customerName: "FIS", businessUnit: "BU Financial", hunterTarget: 400000, farmerRenewalTarget: 0, totalTarget: 400000 },
  { year: 2026, customerName: "FUNDAÇÃO ITAÚ", businessUnit: "BU Financial", hunterTarget: 0, farmerRenewalTarget: 371436.39, totalTarget: 371436.39 },
  { year: 2026, customerName: "INTEL", businessUnit: "BU Financial", hunterTarget: 50000, farmerRenewalTarget: 0, totalTarget: 50000 },
  { year: 2026, customerName: "LIVELO S.A.", businessUnit: "BU Financial", hunterTarget: 0, farmerRenewalTarget: 1646702.12, totalTarget: 1646702.12 },
  { year: 2026, customerName: "NEW LOGO", businessUnit: "BU Financial", hunterTarget: 0, farmerRenewalTarget: 250000, totalTarget: 250000 },
  { year: 2026, customerName: "OPEA", businessUnit: "BU Financial", hunterTarget: 1833333.33, farmerRenewalTarget: 0, totalTarget: 1833333.33 },
  { year: 2026, customerName: "PICPAY", businessUnit: "BU Financial", hunterTarget: 1659365.03, farmerRenewalTarget: 1225489.29, totalTarget: 2884854.31 },
  { year: 2026, customerName: "PISMO", businessUnit: "BU Financial", hunterTarget: 600000, farmerRenewalTarget: 0, totalTarget: 600000 },
  { year: 2026, customerName: "PROFESSIONAL SERVICES", businessUnit: "BU Financial", hunterTarget: 1750000, farmerRenewalTarget: 0, totalTarget: 1750000 },
  { year: 2026, customerName: "QUOD", businessUnit: "BU Financial", hunterTarget: 300000, farmerRenewalTarget: 0, totalTarget: 300000 },
  { year: 2026, customerName: "REDECARD", businessUnit: "BU Financial", hunterTarget: 2847489.24, farmerRenewalTarget: 22793051.16, totalTarget: 25640540.4 },
  { year: 2026, customerName: "SANTANDER", businessUnit: "BU Financial", hunterTarget: 14955000, farmerRenewalTarget: 99065844.67, totalTarget: 114020844.67 },
  { year: 2026, customerName: "SICOOB", businessUnit: "BU Financial", hunterTarget: 300000, farmerRenewalTarget: 0, totalTarget: 300000 },
  { year: 2026, customerName: "SICREDI", businessUnit: "BU Financial", hunterTarget: 600000, farmerRenewalTarget: 0, totalTarget: 600000 },
  { year: 2026, customerName: "TRAVELEX", businessUnit: "BU Financial", hunterTarget: 0, farmerRenewalTarget: 1378530.22, totalTarget: 1378530.22 },
  { year: 2026, customerName: "VISA", businessUnit: "BU Financial", hunterTarget: 5868165.97, farmerRenewalTarget: 3376586.86, totalTarget: 9244752.82 },
  { year: 2026, customerName: "VOTORANTIM", businessUnit: "BU Financial", hunterTarget: 800000, farmerRenewalTarget: 14691912.31, totalTarget: 15491912.31 },
  { year: 2026, customerName: "XP INVESTIMENTOS", businessUnit: "BU Financial", hunterTarget: 0, farmerRenewalTarget: 348590.6, totalTarget: 348590.6 },
  { year: 2026, customerName: "ZURICH", businessUnit: "BU Financial", hunterTarget: 850000, farmerRenewalTarget: 4892914.06, totalTarget: 5742914.06 },
];

