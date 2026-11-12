export type MigrationLifecycleStatus = 'not_started' | 'running' | 'completed' | 'failed';

export const MIGRATION_LIFECYCLE_LABELS: Record<MigrationLifecycleStatus, string> = {
  not_started: 'Chưa migration',
  running: 'Đang migration',
  completed: 'Migration thành công',
  failed: 'Migration thất bại',
};

/** Website generation only: neither import verification nor audit/QC determines this status. */
export function migrationLifecycleStatus(status: string | null | undefined): MigrationLifecycleStatus {
  if (!status || status === 'pending' || status === 'not_started') return 'not_started';
  if (status === 'running' || status === 'completed' || status === 'failed') return status;
  throw new Error('Unsupported website migration lifecycle status');
}
