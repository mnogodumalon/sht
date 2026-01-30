// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export interface Employees {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    name?: string;
    role?: 'manager' | 'employee';
    color?: string;
  };
}

export interface Shifts {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    date?: string; // Format: YYYY-MM-DD oder ISO String
    employee?: string; // applookup -> URL zu 'Employees' Record
    shift_type?: 'frueh' | 'spaet' | 'nacht';
  };
}

export const APP_IDS = {
  EMPLOYEES: '697ccf2f77928276d294bf1f',
  SHIFTS: '697ccf2fd1272d36f1e02810',
} as const;

// Helper Types for creating new records
export type CreateEmployees = Employees['fields'];
export type CreateShifts = Shifts['fields'];