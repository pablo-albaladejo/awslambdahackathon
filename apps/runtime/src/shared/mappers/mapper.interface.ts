/**
 * Base interface for all mappers
 * Provides unidirectional mapping from source to target
 */
export interface Mapper<TSource, TTarget> {
  /**
   * Maps a single source object to target object
   */
  map(source: TSource): TTarget;

  /**
   * Maps an array of source objects to target objects
   */
  mapArray(sources: TSource[]): TTarget[];
}

/**
 * Interface for bidirectional mappers
 * Supports mapping in both directions between domain and DTO
 */
export interface BidirectionalMapper<TDomain, TDto> {
  /**
   * Maps domain entity to DTO
   */
  mapToDto(domain: TDomain): TDto;

  /**
   * Maps DTO to domain entity
   */
  mapToDomain(dto: TDto): TDomain;

  /**
   * Maps array of domain entities to DTOs
   */
  mapArrayToDto(domains: TDomain[]): TDto[];

  /**
   * Maps array of DTOs to domain entities
   */
  mapArrayToDomain(dtos: TDto[]): TDomain[];
}

/**
 * Interface for mappers that support partial mapping
 */
export interface PartialMapper<TSource, TTarget>
  extends Mapper<TSource, TTarget> {
  /**
   * Maps partial source object to partial target object
   */
  mapPartial(source: Partial<TSource>): Partial<TTarget>;

  /**
   * Maps array of partial source objects to partial target objects
   */
  mapPartialArray(sources: Partial<TSource>[]): Partial<TTarget>[];
}

/**
 * Interface for mappers with context
 */
export interface ContextualMapper<
  TSource,
  TTarget,
  TContext = Record<string, unknown>,
> {
  /**
   * Maps source to target with additional context
   */
  mapWithContext(source: TSource, context: TContext): TTarget;

  /**
   * Maps array of sources to targets with context
   */
  mapArrayWithContext(sources: TSource[], context: TContext): TTarget[];
}

/**
 * Interface for mappers that can handle validation
 */
export interface ValidatingMapper<TSource, TTarget>
  extends Mapper<TSource, TTarget> {
  /**
   * Maps and validates the result
   */
  mapAndValidate(source: TSource): TTarget;

  /**
   * Maps array and validates all results
   */
  mapArrayAndValidate(sources: TSource[]): TTarget[];
}

/**
 * Mapping result that includes validation information
 */
export interface MappingResult<T> {
  /** The mapped data */
  data: T;

  /** Whether the mapping was successful */
  success: boolean;

  /** Any warnings during mapping */
  warnings?: string[];

  /** Any errors during mapping */
  errors?: string[];

  /** Additional metadata about the mapping */
  metadata?: Record<string, unknown>;
}

/**
 * Interface for mappers that return mapping results
 */
export interface ResultMapper<TSource, TTarget> {
  /**
   * Maps source to target and returns result with metadata
   */
  mapWithResult(source: TSource): MappingResult<TTarget>;

  /**
   * Maps array and returns results with metadata
   */
  mapArrayWithResult(sources: TSource[]): MappingResult<TTarget[]>;
}

/**
 * Configuration for mappers
 */
export interface MapperConfig {
  /** Whether to validate inputs */
  validateInput?: boolean;

  /** Whether to validate outputs */
  validateOutput?: boolean;

  /** Whether to throw on validation errors */
  throwOnError?: boolean;

  /** Whether to include metadata in results */
  includeMetadata?: boolean;

  /** Custom transformation functions */
  transforms?: Record<string, (value: unknown) => unknown>;
}

/**
 * Interface for configurable mappers
 */
export interface ConfigurableMapper<TSource, TTarget>
  extends Mapper<TSource, TTarget> {
  /**
   * Sets the mapper configuration
   */
  configure(config: MapperConfig): void;

  /**
   * Gets the current configuration
   */
  getConfig(): MapperConfig;
}
