'use strict';

const errorMessages = {
  BAD_CONTENT_TYPE: 'Unsupported content type: ',
  LIMIT_FIELD_COUNT: 'Too many fields',
  LIMIT_FIELD_NAME: 'Field name too long',
  LIMIT_FIELD_VALUE: 'Field value too long',
  LIMIT_FILE_COUNT: 'Too many files',
  LIMIT_FILE_SIZE: 'File too large',
  LIMIT_PART_COUNT: 'Too many parts',
  MISSING_FILE: 'Expected file field missing',
  UNEXPECTED_FILE: 'Unexpected file field',
};

class MultipartError extends Error {
  constructor(code, field) {
    super(errorMessages[code]);

    this.code = code;

    if (code === 'BAD_CONTENT_TYPE') {
      this.message += field; // field is the Content-Type header
      this.status = 415;
      return;
    }

    this.status = 400;

    if (field !== undefined) {
      this.field = field;
    }
  }
}

Object.defineProperty(MultipartError.prototype, 'name', {
  value: MultipartError.name,
  writable: true,
  enumerable: false,
  configurable: true,
});

module.exports = MultipartError;
