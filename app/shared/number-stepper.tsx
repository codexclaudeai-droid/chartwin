'use client';

type NumberStepperBaseProps = {
  id: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  ariaLabel?: string;
  placeholder?: string;
  required?: boolean;
  inputMode?: 'numeric' | 'decimal';
};

type StrictNumberStepperProps = NumberStepperBaseProps & {
  value: number;
  onChange: (value: number) => void;
  allowEmpty?: false;
};

type EmptyNumberStepperProps = NumberStepperBaseProps & {
  value: number | '';
  onChange: (value: number | '') => void;
  allowEmpty: true;
};

type NumberStepperProps = StrictNumberStepperProps | EmptyNumberStepperProps;

export function NumberStepper(props: NumberStepperProps) {
  const {
    id,
    value,
    disabled = false,
    min,
    max,
    step = 1,
    className = '',
    ariaLabel,
    placeholder,
    required = false,
    inputMode = 'numeric',
  } = props;
  const classNames = ['number-stepper', className].filter(Boolean).join(' ');
  const numericValue = typeof value === 'number' && Number.isFinite(value) ? value : 0;

  function updateValue(nextValue: number | '') {
    if (nextValue === '') {
      if (props.allowEmpty) props.onChange('');
      return;
    }
    if (!Number.isFinite(nextValue)) return;
    const clampedValue = clampNumber(nextValue, min, max);
    if (props.allowEmpty) {
      props.onChange(clampedValue);
      return;
    }
    props.onChange(clampedValue);
  }

  return (
    <div className={classNames}>
      <input
        disabled={disabled}
        id={id}
        aria-label={ariaLabel}
        inputMode={inputMode}
        max={max}
        min={min}
        placeholder={placeholder}
        required={required}
        step={step}
        type="number"
        value={value}
        onChange={(event) => updateValue(event.target.value === '' ? '' : Number(event.target.value))}
      />
      <div className="number-stepper-controls" aria-hidden="true">
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled || (typeof max === 'number' && numericValue >= max)}
          onClick={() => updateValue(numericValue + step)}
        >
          <ChevronUpIcon />
        </button>
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled || (typeof min === 'number' && numericValue <= min)}
          onClick={() => updateValue(numericValue - step)}
        >
          <ChevronDownIcon />
        </button>
      </div>
    </div>
  );
}

function clampNumber(value: number, min?: number, max?: number): number {
  if (typeof min === 'number' && value < min) return min;
  if (typeof max === 'number' && value > max) return max;
  return value;
}

function ChevronUpIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="m4 10 4-4 4 4" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="m4 6 4 4 4-4" />
    </svg>
  );
}
