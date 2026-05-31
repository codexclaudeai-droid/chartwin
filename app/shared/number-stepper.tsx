'use client';

type NumberStepperProps = {
  id: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
};

export function NumberStepper({
  id,
  value,
  onChange,
  disabled = false,
  min,
  max,
  step = 1,
  className = '',
}: NumberStepperProps) {
  const classNames = ['number-stepper', className].filter(Boolean).join(' ');

  function updateValue(nextValue: number) {
    if (!Number.isFinite(nextValue)) return;
    onChange(clampNumber(nextValue, min, max));
  }

  return (
    <div className={classNames}>
      <input
        disabled={disabled}
        id={id}
        inputMode="numeric"
        max={max}
        min={min}
        step={step}
        type="number"
        value={value}
        onChange={(event) => updateValue(Number(event.target.value))}
      />
      <div className="number-stepper-controls" aria-hidden="true">
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled || (typeof max === 'number' && value >= max)}
          onClick={() => updateValue(value + step)}
        >
          <ChevronUpIcon />
        </button>
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled || (typeof min === 'number' && value <= min)}
          onClick={() => updateValue(value - step)}
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
