import type { ChartServiceRepository } from './repository.ts';
import type { NotificationRecord } from '../../domain/chart-service/index.ts';
import { publishNotificationRecordRealtimeEvent } from './notification-realtime.ts';

export type AsyncChartServiceRepository = {
  [MethodName in keyof ChartServiceRepository]: ChartServiceRepository[MethodName] extends (
    ...args: infer Args
  ) => infer Result
    ? (...args: Args) => Promise<Awaited<Result>>
    : never;
};

export type AsyncChartServicePersistence = {
  repository: AsyncChartServiceRepository;
  runRead<T>(operation: (repository: AsyncChartServiceRepository) => T | Promise<T>): Promise<Awaited<T>>;
  runMutation<T>(operation: (repository: AsyncChartServiceRepository) => T | Promise<T>): Promise<Awaited<T>>;
};

export function createAsyncChartServiceRepository(
  repository: ChartServiceRepository,
): AsyncChartServiceRepository {
  const asyncRepository: Partial<Record<keyof ChartServiceRepository, unknown>> = {};

  for (const methodName of Object.keys(repository) as Array<keyof ChartServiceRepository>) {
    const method = repository[methodName];
    if (typeof method !== 'function') continue;

    if (methodName === 'saveNotification') {
      asyncRepository[methodName] = async (notification: NotificationRecord) => {
        const result = (method as (methodNotification: NotificationRecord) => unknown)
          .apply(repository, [notification]);
        publishNotificationRecordRealtimeEvent(notification);
        return result;
      };
      continue;
    }

    asyncRepository[methodName] = async (...args: unknown[]) => (
      method as (...methodArgs: unknown[]) => unknown
    ).apply(repository, args);
  }

  return asyncRepository as AsyncChartServiceRepository;
}

export function createAsyncChartServicePersistence(
  repository: ChartServiceRepository,
): AsyncChartServicePersistence {
  const asyncRepository = createAsyncChartServiceRepository(repository);
  const runOperation = async <T>(
    operation: (repository: AsyncChartServiceRepository) => T | Promise<T>,
  ): Promise<Awaited<T>> => await operation(asyncRepository);

  return {
    repository: asyncRepository,
    runRead: runOperation,
    runMutation: runOperation,
  };
}
