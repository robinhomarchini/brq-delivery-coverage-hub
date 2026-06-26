// Imported from the Financial BU spreadsheet: Curva de Vendas Revisada (1).xlsx.
// UI text is kept in Portuguese inside components; domain identifiers stay in English.

export interface PortfolioDirector {
  id: string;
  name: string;
  jobTitle: string;
}

export interface PortfolioDeliveryManager {
  id: string;
  name: string;
  directorId: string;
}

export interface RevenuePlan {
  id: string;
  customerName: string;
  customerCluster: string;
  industry: string;
  directorId: string;
  managerIds: string[];
  revenueCurrent: number;
  revenueTarget: number;
  hunterRevenue: number;
  deliveryFarmerRevenue: number;
  sourceCustomerNames: string[];
}

export const portfolioDirectors: PortfolioDirector[] = [
  { id: "ca", name: "CA", jobTitle: "Diretor de Delivery" },
  { id: "ane", name: "Ane Knust", jobTitle: "Diretor de Delivery" },
];

export const portfolioDeliveryManagers: PortfolioDeliveryManager[] = [
  { id: "bruno", name: "Bruno", directorId: "ca" },
  { id: "orion", name: "Orion", directorId: "ca" },
  { id: "fernanda", name: "Fernanda", directorId: "ca" },
  { id: "bonfim", name: "Ricardo Bonfim", directorId: "ca" },
  { id: "ana", name: "Ana Braz", directorId: "ane" },
];

export const revenuePlans: RevenuePlan[] = [
  {
    "id": "portfolio-itau",
    "customerName": "Itaú",
    "customerCluster": "Itaú",
    "industry": "Financial Services",
    "directorId": "ca",
    "managerIds": [
      "bruno",
      "orion",
      "fernanda",
      "bonfim"
    ],
    "revenueCurrent": 195695559.03,
    "revenueTarget": 236805232.37,
    "hunterRevenue": 44089655.33,
    "deliveryFarmerRevenue": 192715577.04,
    "sourceCustomerNames": [
      "BANCO ITAÚ S.A.",
      "FUNDAÇÃO ITAÚ"
    ]
  },
  {
    "id": "portfolio-santander",
    "customerName": "Santander",
    "customerCluster": "Santander",
    "industry": "Financial Services",
    "directorId": "ane",
    "managerIds": [
      "ana"
    ],
    "revenueCurrent": 96001544.74,
    "revenueTarget": 114020844.67,
    "hunterRevenue": 14955000.0,
    "deliveryFarmerRevenue": 99065844.67,
    "sourceCustomerNames": [
      "SANTANDER"
    ]
  },
  {
    "id": "portfolio-b3",
    "customerName": "B3",
    "customerCluster": "B3",
    "industry": "Financial Services",
    "directorId": "ane",
    "managerIds": [
      "ana"
    ],
    "revenueCurrent": 16200000.49,
    "revenueTarget": 36918589.33,
    "hunterRevenue": 7875497.66,
    "deliveryFarmerRevenue": 29043091.67,
    "sourceCustomerNames": [
      "B3",
      "B3 IP",
      "BANCO B3"
    ]
  },
  {
    "id": "portfolio-btg",
    "customerName": "BTG",
    "customerCluster": "BTG",
    "industry": "Financial Services",
    "directorId": "ane",
    "managerIds": [
      "ana"
    ],
    "revenueCurrent": 0.0,
    "revenueTarget": 29925499.89,
    "hunterRevenue": 1974000.0,
    "deliveryFarmerRevenue": 27951499.89,
    "sourceCustomerNames": [
      "BANCO PACTUAL"
    ]
  },
  {
    "id": "portfolio-redecard",
    "customerName": "Redecard",
    "customerCluster": "Redecard",
    "industry": "Financial Services",
    "directorId": "ane",
    "managerIds": [
      "ana"
    ],
    "revenueCurrent": 25043493.22,
    "revenueTarget": 25640540.4,
    "hunterRevenue": 2847489.24,
    "deliveryFarmerRevenue": 22793051.16,
    "sourceCustomerNames": [
      "REDECARD"
    ]
  },
  {
    "id": "portfolio-bv",
    "customerName": "BV",
    "customerCluster": "BV",
    "industry": "Financial Services",
    "directorId": "ane",
    "managerIds": [
      "ana"
    ],
    "revenueCurrent": 27906267.39,
    "revenueTarget": 15491912.31,
    "hunterRevenue": 800000.0,
    "deliveryFarmerRevenue": 14691912.31,
    "sourceCustomerNames": [
      "VOTORANTIM"
    ]
  },
  {
    "id": "portfolio-alelo",
    "customerName": "Alelo",
    "customerCluster": "Alelo",
    "industry": "Financial Services",
    "directorId": "ca",
    "managerIds": [
      "ana"
    ],
    "revenueCurrent": 0.0,
    "revenueTarget": 14211096.32,
    "hunterRevenue": 11033497.05,
    "deliveryFarmerRevenue": 3177599.27,
    "sourceCustomerNames": [
      "ALELO"
    ]
  },
  {
    "id": "portfolio-nuclea",
    "customerName": "Núclea",
    "customerCluster": "Núclea",
    "industry": "Financial Services",
    "directorId": "ca",
    "managerIds": [
      "ana"
    ],
    "revenueCurrent": 10733605.63,
    "revenueTarget": 12435626.88,
    "hunterRevenue": 5668109.65,
    "deliveryFarmerRevenue": 6767517.22,
    "sourceCustomerNames": [
      "CIP"
    ]
  },
  {
    "id": "portfolio-credit-suisse",
    "customerName": "Credit Suisse",
    "customerCluster": "Credit Suisse",
    "industry": "Financial Services",
    "directorId": "ane",
    "managerIds": [
      "ana"
    ],
    "revenueCurrent": 10405485.59,
    "revenueTarget": 12025205.71,
    "hunterRevenue": 0.0,
    "deliveryFarmerRevenue": 12025205.71,
    "sourceCustomerNames": [
      "CREDIT SUISSE"
    ]
  },
  {
    "id": "portfolio-visa",
    "customerName": "Visa",
    "customerCluster": "Visa",
    "industry": "Financial Services",
    "directorId": "ane",
    "managerIds": [
      "ana"
    ],
    "revenueCurrent": 0.0,
    "revenueTarget": 9244752.82,
    "hunterRevenue": 5868165.97,
    "deliveryFarmerRevenue": 3376586.86,
    "sourceCustomerNames": [
      "VISA"
    ]
  },
  {
    "id": "portfolio-zurich",
    "customerName": "Zurich",
    "customerCluster": "Zurich",
    "industry": "Financial Services",
    "directorId": "ane",
    "managerIds": [
      "ana"
    ],
    "revenueCurrent": 7891250.27,
    "revenueTarget": 5742914.06,
    "hunterRevenue": 850000.0,
    "deliveryFarmerRevenue": 4892914.06,
    "sourceCustomerNames": [
      "ZURICH"
    ]
  },
  {
    "id": "portfolio-crt4",
    "customerName": "Crt4",
    "customerCluster": "Crt4",
    "industry": "Financial Services",
    "directorId": "ane",
    "managerIds": [
      "ana"
    ],
    "revenueCurrent": 0.0,
    "revenueTarget": 3767502.13,
    "hunterRevenue": 490066.67,
    "deliveryFarmerRevenue": 3277435.46,
    "sourceCustomerNames": [
      "CRT4"
    ]
  },
  {
    "id": "portfolio-picpay",
    "customerName": "Picpay",
    "customerCluster": "Picpay",
    "industry": "Financial Services",
    "directorId": "ane",
    "managerIds": [
      "ana"
    ],
    "revenueCurrent": 0.0,
    "revenueTarget": 2884854.31,
    "hunterRevenue": 1659365.03,
    "deliveryFarmerRevenue": 1225489.29,
    "sourceCustomerNames": [
      "PICPAY"
    ]
  },
  {
    "id": "portfolio-csf",
    "customerName": "Csf",
    "customerCluster": "Csf",
    "industry": "Financial Services",
    "directorId": "ane",
    "managerIds": [
      "ana"
    ],
    "revenueCurrent": 444625.44,
    "revenueTarget": 2598797.77,
    "hunterRevenue": 2347633.95,
    "deliveryFarmerRevenue": 251163.82,
    "sourceCustomerNames": [
      "CSF"
    ]
  },
  {
    "id": "portfolio-associacao-open-finance",
    "customerName": "Associação Open Finance",
    "customerCluster": "Associação Open Finance",
    "industry": "Financial Services",
    "directorId": "ane",
    "managerIds": [
      "ana"
    ],
    "revenueCurrent": 1141541.45,
    "revenueTarget": 1980193.81,
    "hunterRevenue": 928275.84,
    "deliveryFarmerRevenue": 1051917.96,
    "sourceCustomerNames": [
      "ASSOCIAÇÃO OPEN FINANCE"
    ]
  },
  {
    "id": "portfolio-opea",
    "customerName": "Opea",
    "customerCluster": "Opea",
    "industry": "Financial Services",
    "directorId": "ane",
    "managerIds": [
      "ana"
    ],
    "revenueCurrent": 0.0,
    "revenueTarget": 1833333.33,
    "hunterRevenue": 1833333.33,
    "deliveryFarmerRevenue": 0.0,
    "sourceCustomerNames": [
      "OPEA"
    ]
  },
  {
    "id": "portfolio-professional-services",
    "customerName": "Professional Services",
    "customerCluster": "Professional Services",
    "industry": "Financial Services",
    "directorId": "ane",
    "managerIds": [
      "ana"
    ],
    "revenueCurrent": 0.0,
    "revenueTarget": 1750000.0,
    "hunterRevenue": 1750000.0,
    "deliveryFarmerRevenue": 0.0,
    "sourceCustomerNames": [
      "PROFESSIONAL SERVICES"
    ]
  },
  {
    "id": "portfolio-livelo-s-a",
    "customerName": "Livelo S.A.",
    "customerCluster": "Livelo S.A.",
    "industry": "Financial Services",
    "directorId": "ane",
    "managerIds": [
      "ana"
    ],
    "revenueCurrent": 1989509.21,
    "revenueTarget": 1646702.12,
    "hunterRevenue": 0.0,
    "deliveryFarmerRevenue": 1646702.12,
    "sourceCustomerNames": [
      "LIVELO S.A."
    ]
  },
  {
    "id": "portfolio-travelex",
    "customerName": "Travelex",
    "customerCluster": "Travelex",
    "industry": "Financial Services",
    "directorId": "ane",
    "managerIds": [
      "ana"
    ],
    "revenueCurrent": 1322813.75,
    "revenueTarget": 1378530.22,
    "hunterRevenue": 0.0,
    "deliveryFarmerRevenue": 1378530.22,
    "sourceCustomerNames": [
      "TRAVELEX"
    ]
  },
  {
    "id": "portfolio-bradesco",
    "customerName": "Bradesco",
    "customerCluster": "Bradesco",
    "industry": "Financial Services",
    "directorId": "ane",
    "managerIds": [
      "ana"
    ],
    "revenueCurrent": 0.0,
    "revenueTarget": 1000000.0,
    "hunterRevenue": 1000000.0,
    "deliveryFarmerRevenue": 0.0,
    "sourceCustomerNames": [
      "BRADESCO"
    ]
  },
  {
    "id": "portfolio-banco-abc",
    "customerName": "Banco Abc",
    "customerCluster": "Banco Abc",
    "industry": "Financial Services",
    "directorId": "ane",
    "managerIds": [
      "ana"
    ],
    "revenueCurrent": 880035.78,
    "revenueTarget": 935000.0,
    "hunterRevenue": 0.0,
    "deliveryFarmerRevenue": 935000.0,
    "sourceCustomerNames": [
      "BANCO ABC"
    ]
  },
  {
    "id": "portfolio-banco-bocom",
    "customerName": "Banco Bocom",
    "customerCluster": "Banco Bocom",
    "industry": "Financial Services",
    "directorId": "ane",
    "managerIds": [
      "ana"
    ],
    "revenueCurrent": 977785.79,
    "revenueTarget": 878571.05,
    "hunterRevenue": 0.0,
    "deliveryFarmerRevenue": 878571.05,
    "sourceCustomerNames": [
      "BANCO BOCOM"
    ]
  },
  {
    "id": "portfolio-pismo",
    "customerName": "Pismo",
    "customerCluster": "Pismo",
    "industry": "Financial Services",
    "directorId": "ane",
    "managerIds": [
      "ana"
    ],
    "revenueCurrent": 0.0,
    "revenueTarget": 600000.0,
    "hunterRevenue": 600000.0,
    "deliveryFarmerRevenue": 0.0,
    "sourceCustomerNames": [
      "PISMO"
    ]
  },
  {
    "id": "portfolio-sicredi",
    "customerName": "Sicredi",
    "customerCluster": "Sicredi",
    "industry": "Financial Services",
    "directorId": "ane",
    "managerIds": [
      "ana"
    ],
    "revenueCurrent": 0.0,
    "revenueTarget": 600000.0,
    "hunterRevenue": 600000.0,
    "deliveryFarmerRevenue": 0.0,
    "sourceCustomerNames": [
      "SICREDI"
    ]
  },
  {
    "id": "portfolio-edenred",
    "customerName": "Edenred",
    "customerCluster": "Edenred",
    "industry": "Financial Services",
    "directorId": "ane",
    "managerIds": [
      "ana"
    ],
    "revenueCurrent": 0.0,
    "revenueTarget": 425000.0,
    "hunterRevenue": 425000.0,
    "deliveryFarmerRevenue": 0.0,
    "sourceCustomerNames": [
      "EDENRED"
    ]
  },
  {
    "id": "portfolio-bbts",
    "customerName": "Bbts",
    "customerCluster": "Bbts",
    "industry": "Financial Services",
    "directorId": "ane",
    "managerIds": [
      "ana"
    ],
    "revenueCurrent": 0.0,
    "revenueTarget": 400000.0,
    "hunterRevenue": 400000.0,
    "deliveryFarmerRevenue": 0.0,
    "sourceCustomerNames": [
      "BBTS"
    ]
  },
  {
    "id": "portfolio-csu",
    "customerName": "Csu",
    "customerCluster": "Csu",
    "industry": "Financial Services",
    "directorId": "ane",
    "managerIds": [
      "ana"
    ],
    "revenueCurrent": 0.0,
    "revenueTarget": 400000.0,
    "hunterRevenue": 400000.0,
    "deliveryFarmerRevenue": 0.0,
    "sourceCustomerNames": [
      "CSU"
    ]
  },
  {
    "id": "portfolio-fis",
    "customerName": "Fis",
    "customerCluster": "Fis",
    "industry": "Financial Services",
    "directorId": "ane",
    "managerIds": [
      "ana"
    ],
    "revenueCurrent": 0.0,
    "revenueTarget": 400000.0,
    "hunterRevenue": 400000.0,
    "deliveryFarmerRevenue": 0.0,
    "sourceCustomerNames": [
      "FIS"
    ]
  },
  {
    "id": "portfolio-bullla",
    "customerName": "Bullla",
    "customerCluster": "Bullla",
    "industry": "Financial Services",
    "directorId": "ane",
    "managerIds": [
      "ana"
    ],
    "revenueCurrent": 0.0,
    "revenueTarget": 360000.0,
    "hunterRevenue": 360000.0,
    "deliveryFarmerRevenue": 0.0,
    "sourceCustomerNames": [
      "BULLLA"
    ]
  },
  {
    "id": "portfolio-xp",
    "customerName": "XP",
    "customerCluster": "XP",
    "industry": "Financial Services",
    "directorId": "ane",
    "managerIds": [
      "ana"
    ],
    "revenueCurrent": 801913.46,
    "revenueTarget": 348590.6,
    "hunterRevenue": 0.0,
    "deliveryFarmerRevenue": 348590.6,
    "sourceCustomerNames": [
      "XP INVESTIMENTOS"
    ]
  },
  {
    "id": "portfolio-quod",
    "customerName": "Quod",
    "customerCluster": "Quod",
    "industry": "Financial Services",
    "directorId": "ane",
    "managerIds": [
      "ana"
    ],
    "revenueCurrent": 0.0,
    "revenueTarget": 300000.0,
    "hunterRevenue": 300000.0,
    "deliveryFarmerRevenue": 0.0,
    "sourceCustomerNames": [
      "QUOD"
    ]
  },
  {
    "id": "portfolio-sicoob",
    "customerName": "Sicoob",
    "customerCluster": "Sicoob",
    "industry": "Financial Services",
    "directorId": "ane",
    "managerIds": [
      "ana"
    ],
    "revenueCurrent": 0.0,
    "revenueTarget": 300000.0,
    "hunterRevenue": 300000.0,
    "deliveryFarmerRevenue": 0.0,
    "sourceCustomerNames": [
      "SICOOB"
    ]
  },
  {
    "id": "portfolio-banco-bs2",
    "customerName": "Banco Bs2",
    "customerCluster": "Banco Bs2",
    "industry": "Financial Services",
    "directorId": "ane",
    "managerIds": [
      "ana"
    ],
    "revenueCurrent": 0.0,
    "revenueTarget": 270000.0,
    "hunterRevenue": 270000.0,
    "deliveryFarmerRevenue": 0.0,
    "sourceCustomerNames": [
      "BANCO BS2"
    ]
  },
  {
    "id": "portfolio-new-logo",
    "customerName": "New Logo",
    "customerCluster": "New Logo",
    "industry": "Financial Services",
    "directorId": "ane",
    "managerIds": [
      "ana"
    ],
    "revenueCurrent": 0.0,
    "revenueTarget": 250000.0,
    "hunterRevenue": 0.0,
    "deliveryFarmerRevenue": 250000.0,
    "sourceCustomerNames": [
      "NEW LOGO"
    ]
  },
  {
    "id": "portfolio-asa-investments",
    "customerName": "Asa Investments",
    "customerCluster": "Asa Investments",
    "industry": "Financial Services",
    "directorId": "ane",
    "managerIds": [
      "ana"
    ],
    "revenueCurrent": 0.0,
    "revenueTarget": 200000.0,
    "hunterRevenue": 200000.0,
    "deliveryFarmerRevenue": 0.0,
    "sourceCustomerNames": [
      "ASA INVESTMENTS"
    ]
  },
  {
    "id": "portfolio-banco-rci",
    "customerName": "Banco Rci",
    "customerCluster": "Banco Rci",
    "industry": "Financial Services",
    "directorId": "ane",
    "managerIds": [
      "ana"
    ],
    "revenueCurrent": 0.0,
    "revenueTarget": 150000.0,
    "hunterRevenue": 150000.0,
    "deliveryFarmerRevenue": 0.0,
    "sourceCustomerNames": [
      "BANCO RCI"
    ]
  },
  {
    "id": "portfolio-agibank",
    "customerName": "Agibank",
    "customerCluster": "Agibank",
    "industry": "Financial Services",
    "directorId": "ane",
    "managerIds": [
      "ana"
    ],
    "revenueCurrent": 0.0,
    "revenueTarget": 100000.0,
    "hunterRevenue": 100000.0,
    "deliveryFarmerRevenue": 0.0,
    "sourceCustomerNames": [
      "AGIBANK"
    ]
  },
  {
    "id": "portfolio-intel",
    "customerName": "Intel",
    "customerCluster": "Intel",
    "industry": "Financial Services",
    "directorId": "ane",
    "managerIds": [
      "ana"
    ],
    "revenueCurrent": 0.0,
    "revenueTarget": 50000.0,
    "hunterRevenue": 50000.0,
    "deliveryFarmerRevenue": 0.0,
    "sourceCustomerNames": [
      "INTEL"
    ]
  }
];

export const portfolioSource = {
  fileName: "Curva de Vendas Revisada (1).xlsx",
  summarySheet: "Resumo RL 2026",
  detailSheet: "Sheet1",
  importedAt: "2026-06-24",
  expectedHunterRevenue: 110_525_090,
  expectedDeliveryFarmerRevenue: 427_744_200,
  expectedFinancialRevenue: 538_269_290,
  notes: [
    "Receita Atual usa a coluna Anualizado + CPRB da aba Sheet1 filtrada por BU Financial.",
    "Meta Prevista usa Total RL 2026 do primeiro bloco Financial da aba Resumo RL 2026.",
    "Receita Hunter usa Times - Novo (Venda Líq.) do segundo bloco Financial.",
    "Receita Delivery/Farmer usa Total (Venda Líq.) + Times - Renov. & Ampl. (Venda Líq.) do segundo bloco Financial.",
    "Hunters são usados apenas para atribuição de meta e reporting; não são owners de Delivery.",
  ],
};
