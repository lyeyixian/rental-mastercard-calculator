export interface ConversionData {
  conversionRate: string;
  [key: string]: unknown;
}

export interface ApiResponse {
  data?: ConversionData;
  error?: string;
  [key: string]: unknown;
}

export interface ConversionResult {
  rate: number;
  convertedAmount: number;
  dateStr: string;
}
