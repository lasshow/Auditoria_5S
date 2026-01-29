const PARCELAS_VALIDAS = [
  'Parcela horno grande 1',
  'Parcela horno grande 2',
  'Parcela horno grande 3 (FRB)',
  'Parcela horno pequeño 1',
  'Dojo de formación',
  'Af. Pack & Build',
  'Af. Ventiladores',
  'Parcela BEAS',
  'AF1',
  'Patio exterior'
];

const ESTADOS_VALIDOS = ['pendiente', 'en_progreso', 'completado'];

const Validator = {
  isNonEmptyString(value, maxLength = 500) {
    return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
  },

  isValidDate(value) {
    if (!value || typeof value !== 'string') return false;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(value)) return false;
    const date = new Date(value);
    return date instanceof Date && !isNaN(date);
  },

  isValidParcela(value) {
    return PARCELAS_VALIDAS.includes(value);
  },

  isValidBoolean(value) {
    if (typeof value === 'boolean') return true;
    if (typeof value === 'string') {
      return ['si', 'no', 'true', 'false', '1', '0'].includes(value.toLowerCase());
    }
    return typeof value === 'number' && (value === 0 || value === 1);
  },

  toDbBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return ['si', 'true', '1'].includes(value.toLowerCase());
    }
    return !!value;
  },

  isValidDesglose(arr) {
    if (!Array.isArray(arr)) return false;
    return arr.every(item =>
      typeof item === 'object' &&
      typeof item.linea === 'number' &&
      item.linea > 0
    );
  },

  sanitizeString(value, maxLength = 500) {
    if (typeof value !== 'string') return '';
    return value.trim().slice(0, maxLength);
  },

  isValidId(value) {
    const num = parseInt(value);
    return !isNaN(num) && num > 0;
  },

  isValidEstado(value) {
    return ESTADOS_VALIDOS.includes(value);
  }
};

module.exports = { Validator, PARCELAS_VALIDAS, ESTADOS_VALIDOS };
