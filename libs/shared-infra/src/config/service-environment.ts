export type NodeEnvironment = 'development' | 'test' | 'production';

export interface ServiceEnvironment {
  nodeEnvironment: NodeEnvironment;
  serviceName: string;
  appVersion: string;
  servicePort: number;
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    ssl: boolean;
  };
  kafka: {
    brokers: string[];
    clientId: string;
    consumerGroupId: string;
  };
}

export interface ServiceEnvironmentDefaults {
  serviceName: string;
  appVersion: string;
  servicePort: number;
  databaseName: string;
  databasePort: number;
  databaseHost?: string;
  databaseUser?: string;
  databasePassword?: string;
  databaseSsl?: boolean;
  kafkaBrokers: string[];
  kafkaClientId: string;
  kafkaConsumerGroupId: string;
}

export const SERVICE_ENVIRONMENT = Symbol('SERVICE_ENVIRONMENT');

export function createServiceEnvironment(
  defaults: ServiceEnvironmentDefaults,
  source: NodeJS.ProcessEnv = process.env
): ServiceEnvironment {
  return {
    nodeEnvironment: parseNodeEnvironment(source['NODE_ENV']),
    serviceName: parseString(source['SERVICE_NAME'], defaults.serviceName, 'SERVICE_NAME'),
    appVersion: parseString(source['APP_VERSION'], defaults.appVersion, 'APP_VERSION'),
    servicePort: parsePositiveInteger(source['PORT'], defaults.servicePort, 'PORT'),
    database: {
      host: parseString(
        source['DATABASE_HOST'],
        defaults.databaseHost ?? 'localhost',
        'DATABASE_HOST'
      ),
      port: parsePositiveInteger(
        source['DATABASE_PORT'],
        defaults.databasePort,
        'DATABASE_PORT'
      ),
      name: parseString(source['DATABASE_NAME'], defaults.databaseName, 'DATABASE_NAME'),
      user: parseString(
        source['DATABASE_USER'],
        defaults.databaseUser ?? 'postgres',
        'DATABASE_USER'
      ),
      password: parseString(
        source['DATABASE_PASSWORD'],
        defaults.databasePassword ?? 'postgres',
        'DATABASE_PASSWORD'
      ),
      ssl: parseBoolean(source['DATABASE_SSL'], defaults.databaseSsl ?? false, 'DATABASE_SSL')
    },
    kafka: {
      brokers: parseBrokers(source['KAFKA_BROKERS'], defaults.kafkaBrokers),
      clientId: parseString(
        source['KAFKA_CLIENT_ID'],
        defaults.kafkaClientId,
        'KAFKA_CLIENT_ID'
      ),
      consumerGroupId: parseString(
        source['KAFKA_CONSUMER_GROUP_ID'],
        defaults.kafkaConsumerGroupId,
        'KAFKA_CONSUMER_GROUP_ID'
      )
    }
  };
}

function parseNodeEnvironment(rawValue?: string): NodeEnvironment {
  if (rawValue === undefined || rawValue.trim() === '') {
    return 'development';
  }

  if (rawValue === 'development' || rawValue === 'test' || rawValue === 'production') {
    return rawValue;
  }

  throw new Error('NODE_ENV must be one of development, test, or production');
}

function parseString(rawValue: string | undefined, fallbackValue: string, label: string): string {
  const value = rawValue?.trim() ?? fallbackValue.trim();

  if (value.length === 0) {
    throw new Error(`${label} cannot be empty`);
  }

  return value;
}

function parsePositiveInteger(
  rawValue: string | undefined,
  fallbackValue: number,
  label: string
): number {
  if (rawValue === undefined || rawValue.trim() === '') {
    return fallbackValue;
  }

  const parsedValue = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }

  return parsedValue;
}

function parseBoolean(rawValue: string | undefined, fallbackValue: boolean, label: string): boolean {
  if (rawValue === undefined || rawValue.trim() === '') {
    return fallbackValue;
  }

  if (rawValue === 'true' || rawValue === '1') {
    return true;
  }

  if (rawValue === 'false' || rawValue === '0') {
    return false;
  }

  throw new Error(`${label} must be true, false, 1, or 0`);
}

function parseBrokers(rawValue: string | undefined, fallbackValue: string[]): string[] {
  const parsedValue =
    rawValue === undefined || rawValue.trim() === ''
      ? fallbackValue
      : rawValue
          .split(',')
          .map((broker) => broker.trim())
          .filter((broker) => broker.length > 0);

  if (parsedValue.length === 0) {
    throw new Error('KAFKA_BROKERS must contain at least one broker');
  }

  return parsedValue;
}
