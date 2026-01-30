// AUTOMATICALLY GENERATED SERVICE
import { APP_IDS } from '@/types/app';
import type { Employees, Shifts } from '@/types/app';

// Base Configuration
const API_BASE_URL = 'https://my.living-apps.de/rest';

// --- HELPER FUNCTIONS ---
export function extractRecordId(url: string | null | undefined): string | null {
  if (!url) return null;
  // Extrahiere die letzten 24 Hex-Zeichen mit Regex
  const match = url.match(/([a-f0-9]{24})$/i);
  return match ? match[1] : null;
}

export function createRecordUrl(appId: string, recordId: string): string {
  return `https://my.living-apps.de/rest/apps/${appId}/records/${recordId}`;
}

async function callApi(method: string, endpoint: string, data?: any) {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',  // Nutze Session Cookies für Auth
    body: data ? JSON.stringify(data) : undefined
  });
  if (!response.ok) throw new Error(await response.text());
  // DELETE returns often empty body or simple status
  if (method === 'DELETE') return true;
  return response.json();
}

export class LivingAppsService {
  // --- EMPLOYEES ---
  static async getEmployees(): Promise<Employees[]> {
    const data = await callApi('GET', `/apps/${APP_IDS.EMPLOYEES}/records`);
    return Object.entries(data).map(([id, rec]: [string, any]) => ({
      record_id: id, ...rec
    }));
  }
  static async getEmployee(id: string): Promise<Employees | undefined> {
    const data = await callApi('GET', `/apps/${APP_IDS.EMPLOYEES}/records/${id}`);
    return { record_id: data.id, ...data };
  }
  static async createEmployee(fields: Employees['fields']) {
    return callApi('POST', `/apps/${APP_IDS.EMPLOYEES}/records`, { fields });
  }
  static async updateEmployee(id: string, fields: Partial<Employees['fields']>) {
    return callApi('PATCH', `/apps/${APP_IDS.EMPLOYEES}/records/${id}`, { fields });
  }
  static async deleteEmployee(id: string) {
    return callApi('DELETE', `/apps/${APP_IDS.EMPLOYEES}/records/${id}`);
  }

  // --- SHIFTS ---
  static async getShifts(): Promise<Shifts[]> {
    const data = await callApi('GET', `/apps/${APP_IDS.SHIFTS}/records`);
    return Object.entries(data).map(([id, rec]: [string, any]) => ({
      record_id: id, ...rec
    }));
  }
  static async getShift(id: string): Promise<Shifts | undefined> {
    const data = await callApi('GET', `/apps/${APP_IDS.SHIFTS}/records/${id}`);
    return { record_id: data.id, ...data };
  }
  static async createShift(fields: Shifts['fields']) {
    return callApi('POST', `/apps/${APP_IDS.SHIFTS}/records`, { fields });
  }
  static async updateShift(id: string, fields: Partial<Shifts['fields']>) {
    return callApi('PATCH', `/apps/${APP_IDS.SHIFTS}/records/${id}`, { fields });
  }
  static async deleteShift(id: string) {
    return callApi('DELETE', `/apps/${APP_IDS.SHIFTS}/records/${id}`);
  }

}