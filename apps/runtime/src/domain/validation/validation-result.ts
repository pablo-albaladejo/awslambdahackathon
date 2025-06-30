export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface FieldValidationResult {
  field: string;
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface EntityValidationResult extends ValidationResult {
  fieldResults?: FieldValidationResult[];
}
