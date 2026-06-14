export type NodeEnvironment = 'development' | 'test' | 'production';

export interface ServiceEnvironment {
  nodeEnvironment: NodeEnvironment;
  serviceName: string;
  appVersion: string;
  servicePort: number;
  http: {
    corsEnabled: boolean;
    corsAllowedOrigins: string[];
  };
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
  httpCorsAllowedOrigins?: string[];
  httpCorsEnabled?: boolean;
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

const defaultLocalFrontendCorsOrigins = [
  'http://localhost:4100',
  'http://127.0.0.1:4100',
  'http://localhost:4101',
  'http://127.0.0.1:4101',
  'http://localhost:4102',
  'http://127.0.0.1:4102',
  'http://localhost:4200',
  'http://127.0.0.1:4200',
  'http://localhost:4201',
  'http://127.0.0.1:4201',
  'http://localhost:4202',
  'http://127.0.0.1:4202'
] as const;

export function createServiceEnvironment(
  defaults: ServiceEnvironmentDefaults,
  source: NodeJS.ProcessEnv = process.env
): ServiceEnvironment {
  const nodeEnvironment = parseNodeEnvironment(source['NODE_ENV']);
  const fallbackCorsAllowedOrigins =
    defaults.httpCorsAllowedOrigins ??
    (nodeEnvironment === 'development' ? [...defaultLocalFrontendCorsOrigins] : []);
  const corsAllowedOrigins = parseStringList(
    source['HTTP_CORS_ORIGINS'],
    fallbackCorsAllowedOrigins,
    'HTTP_CORS_ORIGINS'
  );

  return {
    nodeEnvironment,
    serviceName: parseString(source['SERVICE_NAME'], defaults.serviceName, 'SERVICE_NAME'),
    appVersion: parseString(source['APP_VERSION'], defaults.appVersion, 'APP_VERSION'),
    servicePort: parsePositiveInteger(source['PORT'], defaults.servicePort, 'PORT'),
    http: {
      corsEnabled: parseBoolean(
        source['HTTP_CORS_ENABLED'],
        defaults.httpCorsEnabled ?? corsAllowedOrigins.length > 0,
        'HTTP_CORS_ENABLED'
      ),
      corsAllowedOrigins
    },
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

function parseStringList(
  rawValue: string | undefined,
  fallbackValue: string[],
  label: string
): string[] {
  if (rawValue === undefined || rawValue.trim() === '') {
    return [...fallbackValue];
  }

  const parsedValue = rawValue
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (parsedValue.length === 0) {
    throw new Error(`${label} must contain at least one value when provided`);
  }

  return parsedValue;
}
