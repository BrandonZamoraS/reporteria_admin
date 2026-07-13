export type DynamicReportSection = {
  establishmentId: number;
  establishmentName: string;
  description: string;
  photos: Blob[];
};

export type DynamicReportPayload = {
  companyId: number;
  companyName: string;
  description: string;
  sections: DynamicReportSection[];
};

/** Maximum photos allowed per store section (matches evidence limit). */
export const MAX_DYNAMIC_REPORT_PHOTOS = 6;
