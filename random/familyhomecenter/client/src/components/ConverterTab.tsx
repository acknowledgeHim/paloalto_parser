import { useState } from 'react';
import {
  VOLUME_UNITS,
  WEIGHT_UNITS,
  convertVolume,
  convertWeight,
  celsiusToFahrenheit,
  fahrenheitToCelsius,
} from '../utils/units.js';

type Category = 'volume' | 'weight' | 'temperature';

function VolumeOrWeightConverter({ category }: { category: 'volume' | 'weight' }) {
  const units = category === 'volume' ? VOLUME_UNITS : WEIGHT_UNITS;
  const defaultUnits = category === 'volume' ? ['cup', 'ml'] : ['oz', 'g'];
  const [value, setValue] = useState(1);
  const [fromUnit, setFromUnit] = useState(defaultUnits[0]);
  const [toUnit, setToUnit] = useState(defaultUnits[1]);

  const result = category === 'volume' ? convertVolume(value, fromUnit, toUnit) : convertWeight(value, fromUnit, toUnit);

  return (
    <div className="converter-tab__inputs">
      <input type="number" value={value} onChange={(e) => setValue(Number(e.target.value) || 0)} />
      <select value={fromUnit} onChange={(e) => setFromUnit(e.target.value)}>
        {Object.entries(units).map(([key, u]) => (
          <option key={key} value={key}>{u.label}</option>
        ))}
      </select>
      <span className="converter-tab__arrow">=</span>
      <div className="converter-tab__result">{result.toFixed(2)}</div>
      <select value={toUnit} onChange={(e) => setToUnit(e.target.value)}>
        {Object.entries(units).map(([key, u]) => (
          <option key={key} value={key}>{u.label}</option>
        ))}
      </select>
    </div>
  );
}

function TemperatureConverter() {
  const [direction, setDirection] = useState<'f-to-c' | 'c-to-f'>('f-to-c');
  const [value, setValue] = useState(350);
  const result = direction === 'f-to-c' ? fahrenheitToCelsius(value) : celsiusToFahrenheit(value);

  return (
    <div className="converter-tab__inputs">
      <input type="number" value={value} onChange={(e) => setValue(Number(e.target.value) || 0)} />
      <select value={direction} onChange={(e) => setDirection(e.target.value as 'f-to-c' | 'c-to-f')}>
        <option value="f-to-c">°F → °C</option>
        <option value="c-to-f">°C → °F</option>
      </select>
      <span className="converter-tab__arrow">=</span>
      <div className="converter-tab__result">{result.toFixed(1)}°{direction === 'f-to-c' ? 'C' : 'F'}</div>
    </div>
  );
}

export function ConverterTab() {
  const [category, setCategory] = useState<Category>('volume');

  return (
    <div className="panel converter-tab">
      <h2>Kitchen unit converter</h2>
      <p className="hint">Metric ⇄ US standard, for scaling or converting recipe measurements.</p>
      <div className="task-form__row">
        <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
          <option value="volume">Volume</option>
          <option value="weight">Weight</option>
          <option value="temperature">Oven temperature</option>
        </select>
      </div>
      {category === 'temperature' ? (
        <TemperatureConverter />
      ) : (
        <VolumeOrWeightConverter key={category} category={category} />
      )}
    </div>
  );
}
