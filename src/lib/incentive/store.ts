/**
 * incentive/store.ts – Persistenz der Incentive-Pläne (Tabelle incentive_plans).
 */
import '../database';
import { dbGet, dbAll, dbRun } from '../dbq';
import crypto from 'node:crypto';
import type { IncentiveBrief, IncentivePlan, IncentivePlanRecord, IncentiveProgress } from './types';

export interface IncentiveListRow { id: string; created_at: string; title: string; status: string }

export async function createIncentivePlan(title: string, brief: IncentiveBrief, plan: IncentivePlan | null, status = 'draft'): Promise<string> {
  const id = crypto.randomUUID();
  await dbRun(
    `INSERT INTO incentive_plans (id, title, status, brief, plan) VALUES (?, ?, ?, ?, ?)`,
    [id, title || 'Incentive', status, JSON.stringify(brief), plan ? JSON.stringify(plan) : '']
  );
  return id;
}

export async function listIncentivePlans(): Promise<IncentiveListRow[]> {
  return dbAll<IncentiveListRow>(`SELECT id, created_at, title, status FROM incentive_plans ORDER BY created_at DESC`);
}

export async function getIncentivePlan(id: string): Promise<IncentivePlanRecord | null> {
  const row = await dbGet<{ id: string; created_at: string; title: string; status: string; brief: string; plan: string; error?: string; progress?: string }>(
    `SELECT id, created_at, title, status, brief, plan, error, progress FROM incentive_plans WHERE id = ?`, [id]
  );
  if (!row) return null;
  let brief: IncentiveBrief; let plan: IncentivePlan | null = null; let progress: IncentiveProgress | null = null;
  try { brief = JSON.parse(row.brief); } catch { brief = {} as IncentiveBrief; }
  try { plan = row.plan ? JSON.parse(row.plan) : null; } catch { plan = null; }
  try { progress = row.progress ? JSON.parse(row.progress) : null; } catch { progress = null; }
  return { id: row.id, created_at: row.created_at, title: row.title, status: row.status, brief, plan, error: row.error || '', progress };
}

export async function updateIncentivePlan(id: string, fields: { title?: string; status?: string; plan?: IncentivePlan; error?: string; progress?: IncentiveProgress }): Promise<void> {
  const sets: string[] = []; const vals: unknown[] = [];
  if (fields.title !== undefined) { sets.push('title = ?'); vals.push(fields.title); }
  if (fields.status !== undefined) { sets.push('status = ?'); vals.push(fields.status); }
  if (fields.plan !== undefined) { sets.push('plan = ?'); vals.push(JSON.stringify(fields.plan)); }
  if (fields.error !== undefined) { sets.push('error = ?'); vals.push(fields.error); }
  if (fields.progress !== undefined) { sets.push('progress = ?'); vals.push(JSON.stringify(fields.progress)); }
  if (!sets.length) return;
  await dbRun(`UPDATE incentive_plans SET ${sets.join(', ')} WHERE id = ?`, [...vals, id]);
}

export async function deleteIncentivePlan(id: string): Promise<void> {
  await dbRun(`DELETE FROM incentive_plans WHERE id = ?`, [id]);
}
